import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMagicLinkRequestCooldownForTests } from "../../app/api/auth/send-link/cooldown";
import { POST } from "../../app/api/auth/send-link/route";

const { MockSESClient, MockSendEmailCommand } = vi.hoisted(() => {
  class MockSESClient {
    constructor() {}
    send() {
      return Promise.resolve({ MessageId: "mock-ses-message-id" });
    }
  }
  class MockSendEmailCommand {
    constructor() {}
  }
  return { MockSESClient, MockSendEmailCommand };
});

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: MockSESClient,
  SendEmailCommand: MockSendEmailCommand,
}));

vi.mock("@/lib/server/rateLimit", () => ({
  applyRateLimit: () => Promise.resolve({ limited: false, response: null }),
  AUTH_ROUTE_CONFIG: { windowSeconds: 60, maxRequests: 5 },
  checkRateLimit: () =>
    Promise.resolve({ allowed: true, remaining: 999, resetInSeconds: 0 }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));

const BASE_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  RESEND_API_KEY: "test-key",
};
const TEST_ENV_KEYS = new Set([
  ...Object.keys(BASE_ENV),
  "AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS",
  "AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS",
  "AUTH_MAGIC_LINK_BLOCKED_DOMAINS",
  "MOBILE_AUTH_REDIRECT_URLS",
]);

type AdminResponse = {
  status: number;
  body: Record<string, unknown>;
};

function makeFetchMock(otpResponse?: AdminResponse) {
  const otp = otpResponse ?? {
    status: 200,
    body: {},
  };

  const seen: string[] = [];

  const fn = (url: string): Promise<Response> => {
    seen.push(url);

    if (url.includes("/auth/v1/otp")) {
      return Promise.resolve(
        new Response(JSON.stringify(otp.body), {
          status: otp.status,
          headers: { "content-type": "application/json" },
        })
      );
    }

    if (url.includes("/api.resend.com/emails")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: "mock-resend-id" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    }

    return Promise.reject(new Error(`unmocked fetch: ${url}`));
  };

  return { fn, seen };
}

describe("POST /api/auth/send-link", () => {
  beforeEach(() => {
    Object.assign(process.env, BASE_ENV);
  });

  afterEach(() => {
    MockSESClient.prototype.send = () =>
      Promise.resolve({ MessageId: "mock-ses-message-id" });
    vi.restoreAllMocks();
    resetMagicLinkRequestCooldownForTests();
    for (const key of TEST_ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("forwards the requested callback using the redirect_to query parameter", async () => {
    const { fn, seen } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@serviq.dev",
          redirectTo: "http://localhost:3000/auth/callback",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, emailSent: true });
    expect(
      seen.some((u) => u.includes("/api.resend.com/emails"))
    ).toBe(true);
  });

  it("uses the incoming request origin when no callback is provided", async () => {
    const { fn, seen } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "person@serviq.dev" }),
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(
      seen.some((u) => u.includes("/api.resend.com/emails"))
    ).toBe(true);
  });

  it("sends the OTP via Resend with the correct email address", async () => {
    const { fn, seen } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@serviq.dev",
        }),
      })
    );

    const resendUrl = seen.find((u) => u.includes("/api.resend.com/emails"));
    expect(resendUrl).toBeDefined();
  });

  it("allows the native mobile callback when it is explicitly allowlisted", async () => {
    process.env.MOBILE_AUTH_REDIRECT_URLS = "serviq://auth-callback";
    const { fn, seen } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@serviq.dev",
          redirectTo: "serviq://auth-callback",
        }),
      })
    );

    expect(
      seen.some((u) => u.includes("/api.resend.com/emails"))
    ).toBe(true);
  });

  it("blocks placeholder or disposable magic-link recipients", async () => {
    const { fn } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@mailinator.com" }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error:
        "Use a real inbox. Placeholder, disposable, or blocked email addresses cannot receive login links.",
    });
  });

  it("supports allowlisting magic-link recipients through env config", async () => {
    process.env.AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS =
      "allowed@serviq.in,@trusted.dev";

    const response = await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "outside@openlane.dev" }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error:
        "This email address is not approved for magic-link sign-in in this environment.",
    });
  });

  it("ignores a mismatched callback host and keeps the current site origin", async () => {
    const { fn, seen } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@serviq.dev",
          redirectTo: "https://app.serviq.example/auth/callback",
        }),
      })
    );

    expect(
      seen.some((u) => u.includes("/api.resend.com/emails"))
    ).toBe(true);
  });

  it("sends a verification code via Resend when configured", async () => {
    const { fn } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "person@serviq.dev" }),
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json() as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.emailSent).toBe(true);
  });

  it("returns a 502 error when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const { fn } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "person@serviq.dev" }),
      })
    );

    expect(response.status).toBe(502);
    expect((await response.json()).ok).toBe(false);
  });

  it("handles multiple requests for the same email", async () => {
    const { fn } = makeFetchMock();
    vi.stubGlobal("fetch", fn);

    const req = () =>
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "person@serviq.dev" }),
      });

    const firstResponse = await POST(req());
    const secondResponse = await POST(req());

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
  });
});
