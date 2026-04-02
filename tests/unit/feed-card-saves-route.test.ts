import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestAuthMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();
const createSupabaseUserServerClientMock = vi.fn();

vi.mock("@/lib/server/requestAuth", () => ({
  requireRequestAuth: requireRequestAuthMock,
}));

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabaseUserServerClient: createSupabaseUserServerClientMock,
}));

const authContext = {
  ok: true as const,
  auth: {
    userId: "user-1",
    email: "user@example.com",
    accessToken: "token-1",
  },
};

describe("POST /api/feed-card-saves", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    createSupabaseUserServerClientMock.mockReset();
  });

  it("persists a saved feed card for the authenticated user", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const dbClient = {
      from: vi.fn(() => ({
        upsert,
      })),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/feed-card-saves/route");
    const response = await POST(
      new Request("http://localhost:3000/api/feed-card-saves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save",
          card: {
            card_id: "welcome-help-1",
            focus_id: "help-1",
            card_type: "demand",
            title: "Need a same-day courier",
            subtitle: "A connected neighbor needs a courier today",
            action_path: "/dashboard?focus=help-1",
            metadata: {
              priceLabel: "Budget INR 800",
            },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(dbClient.from).toHaveBeenCalledWith("feed_card_saves");
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        card_id: "welcome-help-1",
        focus_id: "help-1",
        card_type: "demand",
        title: "Need a same-day courier",
        subtitle: "A connected neighbor needs a courier today",
        action_path: "/dashboard?focus=help-1",
        metadata: {
          priceLabel: "Budget INR 800",
        },
      },
      {
        onConflict: "user_id,card_id",
      }
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("removes only the authenticated user's saved card", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const eqCardId = vi.fn().mockResolvedValue({ error: null });
    const eqUserId = vi.fn(() => ({
      eq: eqCardId,
    }));
    const deleteFn = vi.fn(() => ({
      eq: eqUserId,
    }));
    const dbClient = {
      from: vi.fn(() => ({
        delete: deleteFn,
      })),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/feed-card-saves/route");
    const response = await POST(
      new Request("http://localhost:3000/api/feed-card-saves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "remove",
          cardId: "welcome-help-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(dbClient.from).toHaveBeenCalledWith("feed_card_saves");
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(eqUserId).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqCardId).toHaveBeenCalledWith("card_id", "welcome-help-1");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects malformed save payloads", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const { POST } = await import("../../app/api/feed-card-saves/route");
    const response = await POST(
      new Request("http://localhost:3000/api/feed-card-saves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save",
          card: {
            card_id: "",
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Request body does not match the feed card save schema.",
    });
  });
});
