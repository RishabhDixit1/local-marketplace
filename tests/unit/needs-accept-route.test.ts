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

const makeConditionalUpdateChain = () => {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(async () => ({ error: null })),
  };

  return chain;
};

const makeUpdateChain = () => {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(async () => ({ error: null })),
  };

  return chain;
};

describe("POST /api/needs/accept", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    createSupabaseUserServerClientMock.mockReset();
  });

  it("reopens relisted declined requests before accepting them again", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: {
        requester_id: "requester-1",
        accepted_provider_id: null,
        status: "cancelled",
        metadata: {
          relist_after_decline: true,
          last_declined_provider_id: "provider-1",
        },
      },
      error: null,
    });
    const reopenChain = makeConditionalUpdateChain();
    const metadataUpdateChain = makeUpdateChain();
    const metadataClient = {
      from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValueOnce(reopenChain).mockReturnValueOnce(metadataUpdateChain),
    };
    const dbClient = {
      rpc: vi.fn(async () => ({ data: true, error: null })),
    };

    createSupabaseAdminClientMock.mockReturnValue(metadataClient);
    createSupabaseUserServerClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/accept/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(reopenChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        updated_at: expect.any(String),
      })
    );
    expect(reopenChain.eq).toHaveBeenNthCalledWith(1, "id", "help-1");
    expect(reopenChain.eq).toHaveBeenNthCalledWith(2, "status", "cancelled");
    expect(reopenChain.is).toHaveBeenCalledWith("accepted_provider_id", null);
    expect(dbClient.rpc).toHaveBeenCalledWith("accept_help_request", {
      target_help_request_id: "help-1",
    });
    expect(metadataUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          progress_stage: "pending_acceptance",
          progress_updated_at: expect.any(String),
          relist_after_decline: false,
          last_declined_at: null,
          last_declined_provider_id: null,
          cancelled_from_stage: null,
          cancelled_by_user_id: null,
        }),
        updated_at: expect.any(String),
      })
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "accepted",
      helpRequestId: "help-1",
    });
  });

  it("rejects attempts to accept your own task", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const selectChain = makeSelectChain({
      data: {
        requester_id: "provider-1",
        accepted_provider_id: null,
        status: "open",
        metadata: null,
      },
      error: null,
    });
    const metadataClient = {
      from: vi.fn().mockReturnValueOnce(selectChain),
    };
    const dbClient = {
      rpc: vi.fn(async () => ({ data: true, error: null })),
    };

    createSupabaseAdminClientMock.mockReturnValue(metadataClient);
    createSupabaseUserServerClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/accept/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(dbClient.rpc).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "You cannot accept your own task.",
    });
  });
});
