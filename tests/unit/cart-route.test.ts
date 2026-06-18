import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    userId: "user-1",
    email: "user@example.com",
    accessToken: "token-1",
  },
};

// Chain for queries ending in .maybeSingle() — the terminal method returns a promise
const makeMaybeSingleChain = <T>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    update: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  return chain;
};

// Chain for queries that end with .order() and are awaited directly (no terminal method)
const makeOrderTerminalChain = <T>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(async () => result),
  };
  return chain;
};

// Chain for insert+select (returning many rows via select, not maybeSingle)
const makeInsertSelectChain = <T>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(async () => result),
  };
  return chain;
};

// Chain for delete + eq terminal
const makeDeleteChain = (result: { error: { message: string } | null }) => {
  const chain = {
    delete: vi.fn(() => chain),
    eq: vi.fn(async () => result),
  };
  return chain;
};

// Chain for update + eq terminal
const makeUpdateChain = (result: { error: { message: string } | null }) => {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(async () => result),
  };
  return chain;
};

function buildDb(fn: (table: string) => object) {
  return { from: vi.fn(fn) };
}

describe("GET /api/cart", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("returns empty items when cart exists with no items", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const cartChain = makeMaybeSingleChain({ data: { id: "cart-1" }, error: null });
    const itemsChain = makeOrderTerminalChain({ data: [], error: null });

    createSupabaseAdminClientMock.mockReturnValue(
      buildDb((table: string) => {
        if (table === "carts") return cartChain;
        if (table === "cart_items") return itemsChain;
        throw new Error(`Unexpected table: ${table}`);
      })
    );

    const { GET } = await import("../../app/api/cart/route");
    const response = await GET(new Request("http://localhost:3000/api/cart"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ items: [] });
  });

  it("creates a cart if none exists and returns empty items", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    // First carts query: no existing cart (maybeSingle returns null)
    // Second carts query: insert (insert+select+maybeSingle returns new cart)
    const cartFind = makeMaybeSingleChain({ data: null, error: null });
    const cartInsert = makeMaybeSingleChain({ data: { id: "cart-2" }, error: null });
    const itemsChain = makeOrderTerminalChain({ data: [], error: null });

    let cartsCall = 0;
    createSupabaseAdminClientMock.mockReturnValue(
      buildDb((table: string) => {
        if (table === "carts") {
          cartsCall++;
          return cartsCall === 1 ? cartFind : cartInsert;
        }
        if (table === "cart_items") return itemsChain;
        throw new Error(`Unexpected table: ${table}`);
      })
    );

    const { GET } = await import("../../app/api/cart/route");
    const response = await GET(new Request("http://localhost:3000/api/cart"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ items: [] });
  });

  it("returns 401 when not authenticated", async () => {
    requireRequestAuthMock.mockResolvedValue({
      ok: false,
      message: "Unauthorized",
      status: 401,
    });

    const { GET } = await import("../../app/api/cart/route");
    const response = await GET(new Request("http://localhost:3000/api/cart"));

    expect(response.status).toBe(401);
  });
});

describe("PUT /api/cart", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("replaces cart items and returns them", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const cartChain = makeMaybeSingleChain({ data: { id: "cart-1" }, error: null });

    // cart_items chain: .delete().eq() first, then .insert().select()
    const deleteItems = makeDeleteChain({ error: null });
    const insertItems = makeInsertSelectChain({
      data: [{
        id: "item-1",
        cart_id: "cart-1",
        item_type: "service",
        item_id: "svc-1",
        provider_id: "prov-1",
        provider_name: "Provider One",
        title: "AC Repair",
        price_paise: 149900,
        quantity: 1,
        delivery_method: null,
        created_at: "2026-06-18T00:00:00Z",
      }],
      error: null,
    });

    const updateCart = makeUpdateChain({ error: null });

    let itemsCall = 0;
    let cartsCall = 0;
    createSupabaseAdminClientMock.mockReturnValue(
      buildDb((table: string) => {
        if (table === "carts") {
          cartsCall++;
          return cartsCall === 1 ? cartChain : updateCart;
        }
        if (table === "cart_items") {
          itemsCall++;
          return itemsCall === 1 ? deleteItems : insertItems;
        }
        throw new Error(`Unexpected table: ${table}`);
      })
    );

    const { PUT } = await import("../../app/api/cart/route");
    const response = await PUT(
      new NextRequest("http://localhost:3000/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            itemType: "service",
            itemId: "svc-1",
            providerId: "prov-1",
            providerName: "Provider One",
            title: "AC Repair",
            price: 149900,
            quantity: 1,
          }],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].itemId).toBe("svc-1");
  });

  it("clears cart when empty items array sent", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const cartChain = makeMaybeSingleChain({ data: { id: "cart-1" }, error: null });
    const cartUpdate = makeUpdateChain({ error: null });
    const deleteItems = makeDeleteChain({ error: null });

    let cartsCall = 0;
    createSupabaseAdminClientMock.mockReturnValue(
      buildDb((table: string) => {
        if (table === "carts") {
          cartsCall++;
          return cartsCall === 1 ? cartChain : cartUpdate;
        }
        if (table === "cart_items") return deleteItems;
        throw new Error(`Unexpected table: ${table}`);
      })
    );

    const { PUT } = await import("../../app/api/cart/route");
    const response = await PUT(
      new NextRequest("http://localhost:3000/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ items: [] });
  });
});

describe("DELETE /api/cart", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("clears the cart and returns success", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const cartChain = makeMaybeSingleChain({ data: { id: "cart-1" }, error: null });
    const deleteItems = makeDeleteChain({ error: null });

    createSupabaseAdminClientMock.mockReturnValue(
      buildDb((table: string) => {
        if (table === "carts") return cartChain;
        if (table === "cart_items") return deleteItems;
        throw new Error(`Unexpected table: ${table}`);
      })
    );

    const { DELETE } = await import("../../app/api/cart/route");
    const response = await DELETE(new Request("http://localhost:3000/api/cart", { method: "DELETE" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });
});

describe("ensureCart edge cases", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("retries select when insert fails (race condition)", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    // First select: no cart exists
    // Insert: fails (e.g., unique constraint race from concurrent request)
    // Retry select: finds cart created by concurrent request
    const selectEmpty = makeMaybeSingleChain({ data: null, error: null });
    const insertFails = makeMaybeSingleChain({ data: null, error: { message: "duplicate key value" } });
    const selectAfterRace = makeMaybeSingleChain({ data: { id: "cart-race-1" }, error: null });
    const itemsChain = makeOrderTerminalChain({ data: [], error: null });

    let cartsCall = 0;
    createSupabaseAdminClientMock.mockReturnValue(
      buildDb((table: string) => {
        if (table === "carts") {
          cartsCall++;
          if (cartsCall === 1) return selectEmpty;
          if (cartsCall === 2) return insertFails;
          if (cartsCall === 3) return selectAfterRace;
          return selectAfterRace;
        }
        if (table === "cart_items") return itemsChain;
        throw new Error(`Unexpected table: ${table}`);
      })
    );

    const { GET } = await import("../../app/api/cart/route");
    const response = await GET(new Request("http://localhost:3000/api/cart"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ items: [] });
  });
});
