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

const makeQuery = <T,>(result: T) => {
  const chain = {
    select: vi.fn(() => chain),
    or: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => result),
  };

  return chain;
};

describe("GET /api/tasks/help-requests", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    createSupabaseUserServerClientMock.mockReset();
  });

  it("returns 401 when Authorization is missing", async () => {
    requireRequestAuthMock.mockResolvedValue({
      ok: false as const,
      status: 401,
      message: "Missing bearer token.",
    });

    const { GET } = await import("../../app/api/tasks/help-requests/route");
    const request = new Request("http://localhost:3000/api/tasks/help-requests", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Missing bearer token.",
    });
  });

  it("merges visible requests with relisted cancelled history for the declining provider", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const visibleRows = [
      {
        id: "request-1",
        requester_id: "user-1",
        accepted_provider_id: null,
        title: "Visible request",
        details: "Need help",
        category: "Repair",
        budget_min: 500,
        budget_max: 1000,
        location_label: "Bengaluru",
        status: "open",
        metadata: null,
        created_at: "2026-03-27T08:00:00.000Z",
      },
      {
        id: "shared-request",
        requester_id: "other-user",
        accepted_provider_id: "user-1",
        title: "Current accepted request",
        details: "Accepted task",
        category: "Install",
        budget_min: 900,
        budget_max: 1400,
        location_label: "Mumbai",
        status: "accepted",
        metadata: null,
        created_at: "2026-03-28T08:00:00.000Z",
      },
    ];
    const historyRows = [
      {
        id: "shared-request",
        requester_id: "other-user",
        accepted_provider_id: null,
        title: "Current accepted request",
        details: "Cancelled duplicate",
        category: "Install",
        budget_min: 900,
        budget_max: 1400,
        location_label: "Mumbai",
        status: "cancelled",
        metadata: {
          relist_after_decline: true,
          last_declined_provider_id: "user-1",
        },
        created_at: "2026-03-28T08:00:00.000Z",
      },
      {
        id: "request-2",
        requester_id: "other-user",
        accepted_provider_id: null,
        title: "Declined history",
        details: "Should remain in cancelled tab",
        category: "Delivery",
        budget_min: 200,
        budget_max: 400,
        location_label: "Delhi",
        status: "cancelled",
        metadata: {
          relist_after_decline: true,
          last_declined_provider_id: "user-1",
        },
        created_at: "2026-03-29T08:00:00.000Z",
      },
    ];

    const visibleQuery = makeQuery({ data: visibleRows, error: null });
    const historyQuery = makeQuery({ data: historyRows, error: null });
    const dbClient = {
      from: vi.fn().mockReturnValueOnce(visibleQuery).mockReturnValueOnce(historyQuery),
    };

    createSupabaseAdminClientMock.mockReturnValue(dbClient);

    const { GET } = await import("../../app/api/tasks/help-requests/route");
    const response = await GET(
      new Request("http://localhost:3000/api/tasks/help-requests", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    expect(visibleQuery.or).toHaveBeenCalledWith("requester_id.eq.user-1,accepted_provider_id.eq.user-1");
    expect(historyQuery.contains).toHaveBeenCalledWith("metadata", {
      relist_after_decline: true,
      last_declined_provider_id: "user-1",
    });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      requests: [
        historyRows[1],
        visibleRows[1],
        visibleRows[0],
      ],
    });
  });
});
