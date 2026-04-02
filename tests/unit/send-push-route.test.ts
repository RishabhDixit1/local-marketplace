import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseAdminClientMock = vi.fn();
const sendPushToUserMock = vi.fn();

vi.mock("@/lib/server/supabaseClients", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/server/pushNotifications", () => ({
  sendPushToUser: sendPushToUserMock,
}));

describe("POST /api/notifications/send-push", () => {
  const originalInternalKey = process.env.SERVIQ_INTERNAL_PUSH_KEY;

  beforeEach(() => {
    vi.resetModules();
    createSupabaseAdminClientMock.mockReset();
    sendPushToUserMock.mockReset();
  });

  afterEach(() => {
    if (typeof originalInternalKey === "string") {
      process.env.SERVIQ_INTERNAL_PUSH_KEY = originalInternalKey;
    } else {
      delete process.env.SERVIQ_INTERNAL_PUSH_KEY;
    }
  });

  it("returns a config error when the internal push key is missing", async () => {
    delete process.env.SERVIQ_INTERNAL_PUSH_KEY;

    const { POST } = await import("../../app/api/notifications/send-push/route");
    const response = await POST(
      new Request("http://localhost:3000/api/notifications/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          title: "Hello",
          body: "World",
        }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "CONFIG",
      message: "SERVIQ_INTERNAL_PUSH_KEY is required for push delivery.",
    });
    expect(sendPushToUserMock).not.toHaveBeenCalled();
  });

  it("rejects requests without the trusted internal header", async () => {
    process.env.SERVIQ_INTERNAL_PUSH_KEY = "internal-secret";
    createSupabaseAdminClientMock.mockReturnValue({ admin: true });

    const { POST } = await import("../../app/api/notifications/send-push/route");
    const response = await POST(
      new Request("http://localhost:3000/api/notifications/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          title: "Hello",
          body: "World",
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Push delivery is restricted to trusted internal callers.",
    });
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
    expect(sendPushToUserMock).not.toHaveBeenCalled();
  });

  it("sends push notifications for trusted internal callers", async () => {
    process.env.SERVIQ_INTERNAL_PUSH_KEY = "internal-secret";
    const adminClient = { admin: true };
    createSupabaseAdminClientMock.mockReturnValue(adminClient);
    sendPushToUserMock.mockResolvedValue({ sent: 1, failed: 0 });

    const { POST } = await import("../../app/api/notifications/send-push/route");
    const response = await POST(
      new Request("http://localhost:3000/api/notifications/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-serviq-internal-key": "internal-secret",
        },
        body: JSON.stringify({
          userId: "user-1",
          title: "Order update",
          body: "Your provider is on the way.",
          data: {
            orderId: "order-1",
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: 1, failed: 0 });
    expect(createSupabaseAdminClientMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(adminClient, "user-1", {
      title: "Order update",
      body: "Your provider is on the way.",
      data: {
        orderId: "order-1",
      },
    });
  });
});
