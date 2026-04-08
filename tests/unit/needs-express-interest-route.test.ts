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
    userId: "provider-1",
    email: "provider@example.com",
    accessToken: "token-1",
  },
};

const makeSelectChain = <T,>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };

  return chain;
};

describe("POST /api/needs/express-interest", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("stores provider interest with the explicit interested status", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: {
        requester_id: "requester-1",
        status: "open",
        accepted_provider_id: null,
      },
      error: null,
    });
    const upsert = vi.fn(async () => ({ error: null }));
    const dbClient = {
      from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValueOnce({ upsert }),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/express-interest/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/express-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        help_request_id: "help-1",
        provider_id: "provider-1",
        score: 0,
        status: "interested",
        updated_at: expect.any(String),
      }),
      { onConflict: "help_request_id,provider_id", ignoreDuplicates: false }
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      helpRequestId: "help-1",
      status: "interested",
    });
  });

  it("rejects expressing interest in your own request", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: {
        requester_id: "provider-1",
        status: "open",
        accepted_provider_id: null,
      },
      error: null,
    });
    const upsert = vi.fn(async () => ({ error: null }));
    const dbClient = {
      from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValueOnce({ upsert }),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/express-interest/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/express-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "You cannot express interest in your own request.",
    });
  });

  it("blocks interest when another provider is already accepted", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: {
        requester_id: "requester-1",
        status: "matched",
        accepted_provider_id: "provider-22",
      },
      error: null,
    });
    const upsert = vi.fn(async () => ({ error: null }));
    const dbClient = {
      from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValueOnce({ upsert }),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/express-interest/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/express-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-1" }),
      })
    );

    expect(response.status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "CLOSED",
      message: "This request already has an accepted provider.",
    });
  });
});
