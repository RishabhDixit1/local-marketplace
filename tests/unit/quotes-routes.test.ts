import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRequestAuthMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();
const createSupabaseUserServerClientMock = vi.fn();
const loadQuoteDraftMock = vi.fn();
const saveQuoteDraftMock = vi.fn();
const sendQuoteDraftMock = vi.fn();

vi.mock("@/lib/server/requestAuth", () => ({
  requireRequestAuth: requireRequestAuthMock,
}));

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabaseUserServerClient: createSupabaseUserServerClientMock,
}));

vi.mock("@/lib/server/quoteWrites", () => ({
  loadQuoteDraft: loadQuoteDraftMock,
  saveQuoteDraft: saveQuoteDraftMock,
  sendQuoteDraft: sendQuoteDraftMock,
}));

const authContext = {
  ok: true as const,
  auth: {
    userId: "user-1",
    email: "user@example.com",
    accessToken: "token-1",
  },
};

const validInput = {
  orderId: "order-1",
  summary: "Quote for AC repair",
  notes: "Includes diagnostics and first visit.",
  taxAmount: 180,
  expiresAt: "2026-03-30",
  lineItems: [
    {
      label: "Diagnostics",
      description: "On-site scope review",
      quantity: 1,
      unitPrice: 799,
    },
  ],
  conversationId: "conversation-1",
};

const quoteContext = {
  mode: "order" as const,
  orderId: "order-1",
  helpRequestId: null,
  consumerId: "consumer-1",
  providerId: "provider-1",
  actorRole: "provider" as const,
  canEdit: true,
  taskTitle: "AC repair",
  taskDescription: "Fix cooling issue",
  locationLabel: "Bengaluru",
  currentStatus: "new_lead",
  suggestedAmount: 799,
  counterpartyName: "Aarav",
};

const quoteDraft = {
  id: "quote-1",
  orderId: "order-1",
  helpRequestId: null,
  providerId: "provider-1",
  consumerId: "consumer-1",
  status: "draft" as const,
  summary: "Quote for AC repair",
  notes: "Includes diagnostics and first visit.",
  subtotal: 799,
  taxAmount: 180,
  total: 979,
  expiresAt: "2026-03-30T23:59:59.000Z",
  sentAt: null,
  createdAt: "2026-03-24T00:00:00.000Z",
  updatedAt: "2026-03-24T00:00:00.000Z",
  lineItems: [
    {
      id: "line-1",
      label: "Diagnostics",
      description: "On-site scope review",
      quantity: 1,
      unitPrice: 799,
      amount: 799,
      sortOrder: 0,
    },
  ],
  metadata: {},
};

describe("quote api routes", () => {
  beforeEach(() => {
    vi.resetModules();
    requireRequestAuthMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    createSupabaseUserServerClientMock.mockReset();
    loadQuoteDraftMock.mockReset();
    saveQuoteDraftMock.mockReset();
    sendQuoteDraftMock.mockReset();
  });

  it("GET /api/quotes/draft returns 400 when the quote target is missing", async () => {
    requireRequestAuthMock.mockResolvedValue(authContext);

    const { GET } = await import("../../app/api/quotes/draft/route");
    const response = await GET(new Request("http://localhost:3000/api/quotes/draft", { method: "GET" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "orderId or helpRequestId is required.",
      details: undefined,
    });
    expect(loadQuoteDraftMock).not.toHaveBeenCalled();
  });

  it("GET /api/quotes/draft returns the quote workspace payload", async () => {
    const dbClient = { role: "admin" };
    requireRequestAuthMock.mockResolvedValue(authContext);
    createSupabaseAdminClientMock.mockReturnValue(dbClient);
    loadQuoteDraftMock.mockResolvedValue({
      ok: true,
      context: quoteContext,
      draft: quoteDraft,
    });

    const { GET } = await import("../../app/api/quotes/draft/route");
    const response = await GET(
      new Request("http://localhost:3000/api/quotes/draft?orderId=order-1", {
        method: "GET",
      })
    );

    expect(loadQuoteDraftMock).toHaveBeenCalledWith({
      db: dbClient,
      userId: "user-1",
      orderId: "order-1",
      helpRequestId: undefined,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      context: quoteContext,
      draft: quoteDraft,
    });
  });

  it("POST /api/quotes/draft maps forbidden quote errors to 403", async () => {
    const dbClient = { role: "admin" };
    requireRequestAuthMock.mockResolvedValue(authContext);
    createSupabaseAdminClientMock.mockReturnValue(dbClient);
    saveQuoteDraftMock.mockResolvedValue({
      ok: false,
      message: "Only the assigned provider can draft and send quotes for this task.",
      forbidden: true,
    });

    const { POST } = await import("../../app/api/quotes/draft/route");
    const response = await POST(
      new Request("http://localhost:3000/api/quotes/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validInput),
      })
    );

    expect(saveQuoteDraftMock).toHaveBeenCalledWith({
      db: dbClient,
      userId: "user-1",
      input: validInput,
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Only the assigned provider can draft and send quotes for this task.",
      details: undefined,
    });
  });

  it("POST /api/quotes/send passes the user client for quote messaging and returns success", async () => {
    const userClient = { role: "user" };
    requireRequestAuthMock.mockResolvedValue(authContext);
    createSupabaseAdminClientMock.mockReturnValue(null);
    createSupabaseUserServerClientMock.mockReturnValue(userClient);
    sendQuoteDraftMock.mockResolvedValue({
      ok: true,
      context: {
        ...quoteContext,
        currentStatus: "quoted",
      },
      draft: {
        ...quoteDraft,
        status: "sent" as const,
        sentAt: "2026-03-24T01:00:00.000Z",
      },
      orderId: "order-1",
      orderStatus: "quoted",
      conversationId: "conversation-1",
    });

    const { POST } = await import("../../app/api/quotes/send/route");
    const response = await POST(
      new Request("http://localhost:3000/api/quotes/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validInput),
      })
    );

    expect(sendQuoteDraftMock).toHaveBeenCalledWith({
      db: userClient,
      userDb: userClient,
      userId: "user-1",
      input: validInput,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      orderId: "order-1",
      orderStatus: "quoted",
      conversationId: "conversation-1",
    });
  });
});
