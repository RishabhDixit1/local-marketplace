import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestAuthMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/server/requestAuth", () => ({
  requireRequestAuth: requireRequestAuthMock,
}));

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

const makeSelectChain = <T,>(result: { data: T; error: { message: string } | null }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };

  return chain;
};

const makeDoubleEqUpdateChain = () => {
  let eqCalls = 0;
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => {
      eqCalls += 1;
      return eqCalls >= 2 ? Promise.resolve({ error: null }) : chain;
    }),
  };

  return chain;
};

const makeEqNeqEqUpdateChain = () => {
  let eqCalls = 0;
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => {
      eqCalls += 1;
      return eqCalls >= 2 ? Promise.resolve({ error: null }) : chain;
    }),
    neq: vi.fn(() => chain),
  };

  return chain;
};

const makeCountChain = (count: number) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(async () => ({ count, error: null })),
  };

  return chain;
};

const makeSingleEqUpdateChain = () => {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(async () => ({ error: null })),
  };

  return chain;
};

describe("POST /api/needs/reopen", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("marks the accepted provider as withdrawn and keeps the request matched when interest remains", async () => {
    requireRequestAuthMock.mockResolvedValue({
      ok: true as const,
      auth: {
        userId: "provider-1",
        email: "provider@example.com",
        accessToken: "token-1",
      },
    });

    const selectChain = makeSelectChain({
      data: {
        id: "help-1",
        requester_id: "requester-1",
        accepted_provider_id: "provider-1",
        status: "accepted",
        title: "Need AC servicing",
        metadata: {
          progress_stage: "accepted",
        },
      },
      error: null,
    });
    const acceptedMatchUpdateChain = makeDoubleEqUpdateChain();
    const reopenOtherMatchesChain = makeEqNeqEqUpdateChain();
    const activeMatchCountChain = makeCountChain(1);
    const helpRequestUpdateChain = makeSingleEqUpdateChain();

    const dbClient = {
      from: vi.fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(acceptedMatchUpdateChain)
        .mockReturnValueOnce(reopenOtherMatchesChain)
        .mockReturnValueOnce(activeMatchCountChain)
        .mockReturnValueOnce(helpRequestUpdateChain),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/reopen/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/reopen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(acceptedMatchUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "withdrawn",
        updated_at: expect.any(String),
      })
    );
    expect(reopenOtherMatchesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        updated_at: expect.any(String),
      })
    );
    expect(activeMatchCountChain.select).toHaveBeenCalledWith("help_request_id", { count: "exact", head: true });
    expect(activeMatchCountChain.in).toHaveBeenCalledWith("status", ["open", "interested"]);
    expect(helpRequestUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "matched",
        accepted_provider_id: null,
        metadata: expect.objectContaining({
          relist_after_decline: true,
          last_declined_provider_id: "provider-1",
          cancelled_by_user_id: "provider-1",
          progress_updated_at: expect.any(String),
        }),
        updated_at: expect.any(String),
      })
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      helpRequestId: "help-1",
      status: "matched",
      previousMatchStatus: "withdrawn",
    });
  });

  it("marks the accepted provider as rejected when the requester reopens the request", async () => {
    requireRequestAuthMock.mockResolvedValue({
      ok: true as const,
      auth: {
        userId: "requester-1",
        email: "requester@example.com",
        accessToken: "token-1",
      },
    });

    const selectChain = makeSelectChain({
      data: {
        id: "help-2",
        requester_id: "requester-1",
        accepted_provider_id: "provider-9",
        status: "accepted",
        title: "Need a carpenter",
        metadata: null,
      },
      error: null,
    });
    const acceptedMatchUpdateChain = makeDoubleEqUpdateChain();
    const reopenOtherMatchesChain = makeEqNeqEqUpdateChain();
    const activeMatchCountChain = makeCountChain(0);
    const helpRequestUpdateChain = makeSingleEqUpdateChain();

    const dbClient = {
      from: vi.fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(acceptedMatchUpdateChain)
        .mockReturnValueOnce(reopenOtherMatchesChain)
        .mockReturnValueOnce(activeMatchCountChain)
        .mockReturnValueOnce(helpRequestUpdateChain),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { POST } = await import("../../app/api/needs/reopen/route");
    const response = await POST(
      new Request("http://localhost:3000/api/needs/reopen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ helpRequestId: "help-2" }),
      })
    );

    expect(response.status).toBe(200);
    expect(acceptedMatchUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        updated_at: expect.any(String),
      })
    );
    expect(helpRequestUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        accepted_provider_id: null,
        metadata: expect.objectContaining({
          relist_after_decline: true,
          last_declined_provider_id: "provider-9",
          cancelled_by_user_id: "requester-1",
          progress_updated_at: expect.any(String),
        }),
        updated_at: expect.any(String),
      })
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      helpRequestId: "help-2",
      status: "open",
      previousMatchStatus: "rejected",
    });
  });
});
