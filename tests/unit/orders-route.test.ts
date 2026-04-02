import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestAuthMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();
const sendOrderEmailMock = vi.fn();

vi.mock("@/lib/server/requestAuth", () => ({
  requireRequestAuth: requireRequestAuthMock,
}));

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/email", () => ({
  sendOrderEmail: sendOrderEmailMock,
}));

const authContext = {
  ok: true as const,
  auth: {
    userId: "consumer-1",
    email: "consumer@example.com",
    accessToken: "token-1",
  },
};

const makeLookupChain = <T,>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn(async () => result),
  };

  return chain;
};

const makeInsertChain = <T,>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(async () => result),
  };

  return chain;
};

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    sendOrderEmailMock.mockReset();
  });

  it("persists checkout address, notes, and payment references in order metadata", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);
    sendOrderEmailMock.mockResolvedValue(undefined);

    const profilesChain = makeLookupChain({
      data: [{ id: "provider-1" }],
      error: null,
    });
    const servicesChain = makeLookupChain({
      data: [{ id: "service-1" }],
      error: null,
    });
    const insertChain = makeInsertChain({
      data: [{ id: "order-1" }],
      error: null,
    });
    const getUserByIdMock = vi.fn(async () => ({
      data: {
        user: {
          email: "consumer@example.com",
          user_metadata: {
            name: "Consumer One",
          },
        },
      },
    }));

    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") return profilesChain;
        if (table === "service_listings") return servicesChain;
        if (table === "orders") return insertChain;
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
      auth: {
        admin: {
          getUserById: getUserByIdMock,
        },
      },
    });

    const { POST } = await import("../../app/api/orders/route");
    const response = await POST(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              providerId: "provider-1",
              itemType: "service",
              itemId: "service-1",
              price: 1499,
              quantity: 2,
              title: "Deep Cleaning",
              address: "221B Baker Street, Bengaluru",
              notes: "Call on arrival",
              payment_method: "razorpay",
              payment_status: "processing",
              razorpay_order_id: "rzp_order_123",
              razorpay_payment_id: "rzp_payment_123",
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      orderIds: ["order-1"],
      count: 1,
    });

    expect(insertChain.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        consumer_id: "consumer-1",
        provider_id: "provider-1",
        listing_type: "service",
        service_id: "service-1",
        listing_id: "service-1",
        price: 1499,
        status: "new_lead",
        metadata: expect.objectContaining({
          source: "cart",
          quantity: 2,
          title: "Deep Cleaning",
          address: "221B Baker Street, Bengaluru",
          notes: "Call on arrival",
          payment_method: "razorpay",
          payment_status: "processing",
          razorpay_order_id: "rzp_order_123",
          razorpay_payment_id: "rzp_payment_123",
        }),
      }),
    ]);

    await vi.waitFor(() => {
      expect(getUserByIdMock).toHaveBeenCalledWith("consumer-1");
      expect(sendOrderEmailMock).toHaveBeenCalledWith({
        type: "placed",
        to: "consumer@example.com",
        recipientName: "Consumer One",
        orderId: "order-1",
        itemTitle: "Deep Cleaning",
        price: 1499,
      });
    });
  });

  it("rejects invalid payment methods before any database lookup runs", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const fromMock = vi.fn();
    createSupabaseAdminClientMock.mockReturnValue({
      from: fromMock,
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    });

    const { POST } = await import("../../app/api/orders/route");
    const response = await POST(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              providerId: "provider-1",
              itemType: "service",
              itemId: "service-1",
              price: 1499,
              payment_method: "stripe",
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "BAD_REQUEST",
      message: "Invalid payment method.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
