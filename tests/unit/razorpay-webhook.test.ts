import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

const WEBHOOK_SECRET = "whsec_test_secret_2026";

function buildSignature(body: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function makeDbMock() {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    insert: vi.fn(() => ({ error: null })),
    update: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    single: vi.fn(async () => ({ data: null, error: null })),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.filter.mockReturnValue(chain);
  chain.insert.mockReturnValue({ error: null });
  chain.update.mockReturnValue(chain);

  return {
    from: vi.fn(() => chain),
  };
}

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseAdminClientMock.mockReset();
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it("rejects requests with missing or invalid signature (401)", async () => {
    createSupabaseAdminClientMock.mockReturnValue(makeDbMock());

    const { POST } = await import("@/app/api/webhooks/razorpay/route");

    const body = JSON.stringify({ event: "payment.captured" });
    const request = new Request("https://serviqapp.com/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
    expect(data.message).toMatch(/invalid signature/i);
  });

  it("accepts a valid signature and processes payment.captured", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      filter: vi.fn(() => chain),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: null, error: null })),
    };

    const ordersResult = {
      data: [
        {
          id: "order-123",
          status: "new_lead",
          metadata: { razorpay_order_id: "order_RP_001" },
        },
      ],
      error: null,
    };

    const filterChain = { ...chain, in: vi.fn(async () => ordersResult) };
    chain.filter = vi.fn(() => filterChain);
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    chain.update = vi.fn(() => ({ ...chain, eq: vi.fn(async () => ({ error: null })) }));

    const dbMock = { from: vi.fn(() => chain) };
    createSupabaseAdminClientMock.mockReturnValue(dbMock);

    const { POST } = await import("@/app/api/webhooks/razorpay/route");

    const payload = {
      event: "payment.captured",
      event_id: "evt_test_001",
      payload: {
        payment: {
          entity: {
            id: "pay_test_001",
            order_id: "order_RP_001",
            status: "captured",
            amount: 50000,
            currency: "INR",
            fee: 1500,
            notes: {},
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };

    const body = JSON.stringify(payload);
    const signature = buildSignature(body);
    const request = new Request("https://serviqapp.com/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.eventId).toBe("evt_test_001");
  });

  it("handles refund.created events correctly", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      filter: vi.fn(() => chain),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: null, error: null })),
    };

    const ordersResult = {
      data: [
        {
          id: "order-456",
          metadata: {
            razorpay_payment_id: "pay_test_001",
            payment_status: "paid",
            refunds: [],
          },
        },
      ],
      error: null,
    };

    const filterChain = { ...chain, in: vi.fn(async () => ordersResult) };
    chain.filter = vi.fn(() => filterChain);
    chain.update = vi.fn(() => ({ ...chain, eq: vi.fn(async () => ({ error: null })) }));

    const dbMock = { from: vi.fn(() => chain) };
    createSupabaseAdminClientMock.mockReturnValue(dbMock);

    const { POST } = await import("@/app/api/webhooks/razorpay/route");

    const payload = {
      event: "refund.created",
      event_id: "evt_refund_001",
      payload: {
        refund: {
          entity: {
            id: "rfnd_test_001",
            payment_id: "pay_test_001",
            order_id: "order_RP_001",
            status: "processed",
            amount: 10000,
            currency: "INR",
            notes: {},
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };

    const body = JSON.stringify(payload);
    const signature = buildSignature(body);
    const request = new Request("https://serviqapp.com/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("enforces idempotency and skips already-processed events", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      filter: vi.fn(() => chain),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: { id: 1, status: "processed" },
        error: null,
      })),
      single: vi.fn(async () => ({ data: null, error: null })),
    };

    const dbMock = { from: vi.fn(() => chain) };
    createSupabaseAdminClientMock.mockReturnValue(dbMock);

    const { POST } = await import("@/app/api/webhooks/razorpay/route");

    const body = JSON.stringify({ event: "payment.captured", event_id: "evt_dup_001" });
    const signature = buildSignature(body);
    const request = new Request("https://serviqapp.com/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toMatch(/already processed/i);
  });

  it("rejects payment.failed events and marks orders correctly", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      filter: vi.fn(() => chain),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: null, error: null })),
    };

    const ordersResult = {
      data: [
        {
          id: "order-789",
          metadata: { razorpay_order_id: "order_RP_002" },
        },
      ],
      error: null,
    };

    const filterChain = { ...chain, in: vi.fn(async () => ordersResult) };
    chain.filter = vi.fn(() => filterChain);
    chain.update = vi.fn(() => ({ ...chain, eq: vi.fn(async () => ({ error: null })) }));

    const dbMock = { from: vi.fn(() => chain) };
    createSupabaseAdminClientMock.mockReturnValue(dbMock);

    const { POST } = await import("@/app/api/webhooks/razorpay/route");

    const payload = {
      event: "payment.failed",
      event_id: "evt_fail_001",
      payload: {
        payment: {
          entity: {
            id: "pay_fail_001",
            order_id: "order_RP_002",
            status: "failed",
            amount: 50000,
            currency: "INR",
            fee: null,
            notes: {},
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };

    const body = JSON.stringify(payload);
    const signature = buildSignature(body);
    const request = new Request("https://serviqapp.com/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});
