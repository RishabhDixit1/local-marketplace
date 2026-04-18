import { Resolver, promises as dnsPromises } from "node:dns";
import { EventEmitter } from "node:events";
import https from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMagicLinkRequestCooldownForTests } from "../../app/api/auth/send-link/cooldown";
import { POST } from "../../app/api/auth/send-link/route";

type MockHttpsPlan =
  | {
      type: "response";
      status: number;
      body?: string;
    }
  | {
      type: "error";
      error?: Error;
    };

type MockClientRequest = EventEmitter & {
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setTimeout: ReturnType<typeof vi.fn>;
};

const installHttpsRequestMock = (plans: MockHttpsPlan[]) => {
  const requests: MockClientRequest[] = [];

  const requestMock = vi.spyOn(https, "request").mockImplementation((options, callback) => {
    const plan = plans.shift();
    if (!plan) {
      throw new Error("Unexpected HTTPS request in test.");
    }

    const request = new EventEmitter() as MockClientRequest;
    request.write = vi.fn();
    request.setTimeout = vi.fn(() => request);
    request.destroy = vi.fn((error?: Error) => {
      queueMicrotask(() => {
        if (error) {
          request.emit("error", error);
        }
        request.emit("close");
      });
      return request;
    });
    request.end = vi.fn(() => {
      queueMicrotask(() => {
        if (plan.type === "error") {
          request.emit("error", plan.error ?? new Error("Mock HTTPS request failed."));
          request.emit("close");
          return;
        }

        const response = new EventEmitter() as EventEmitter & { statusCode?: number };
        response.statusCode = plan.status;
        callback?.(response as never);

        if (plan.body) {
          response.emit("data", Buffer.from(plan.body));
        }

        response.emit("end");
        request.emit("close");
      });
      return request;
    });

    requests.push(request);
    return request as never;
  });

  return { requestMock, requests };
};

describe("POST /api/auth/send-link", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalAllowedRecipients = process.env.AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS;
  const originalBlockedRecipients = process.env.AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS;
  const originalBlockedDomains = process.env.AUTH_MAGIC_LINK_BLOCKED_DOMAINS;
  const originalMobileRedirectUrls = process.env.MOBILE_AUTH_REDIRECT_URLS;

  afterEach(() => {
    vi.restoreAllMocks();
    resetMagicLinkRequestCooldownForTests();

    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    }

    if (originalAllowedRecipients === undefined) {
      delete process.env.AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS;
    } else {
      process.env.AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS = originalAllowedRecipients;
    }

    if (originalBlockedRecipients === undefined) {
      delete process.env.AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS;
    } else {
      process.env.AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS = originalBlockedRecipients;
    }

    if (originalBlockedDomains === undefined) {
      delete process.env.AUTH_MAGIC_LINK_BLOCKED_DOMAINS;
    } else {
      process.env.AUTH_MAGIC_LINK_BLOCKED_DOMAINS = originalBlockedDomains;
    }

    if (originalMobileRedirectUrls === undefined) {
      delete process.env.MOBILE_AUTH_REDIRECT_URLS;
    } else {
      process.env.MOBILE_AUTH_REDIRECT_URLS = originalMobileRedirectUrls;
    }
  });

  it("forwards the requested callback using the redirect_to query parameter", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock, requests } = installHttpsRequestMock([{ type: "response", status: 200, body: "" }]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
        redirectTo: "http://localhost:3000/auth/callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(requestMock).toHaveBeenCalledTimes(1);

    const [options] = requestMock.mock.calls[0];
    const otpUrl = new URL(`https://example.supabase.co${String((options as { path: string }).path)}`);
    const payload = JSON.parse(String(requests[0].write.mock.calls[0][0]));

    expect(otpUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
    expect(payload.redirect_to).toBeUndefined();
    expect(payload.email_redirect_to).toBeUndefined();
  });

  it("uses the incoming request origin when no callback is provided", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock } = installHttpsRequestMock([{ type: "response", status: 200, body: "" }]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [options] = requestMock.mock.calls[0];
    const otpUrl = new URL(`https://example.supabase.co${String((options as { path: string }).path)}`);

    expect(otpUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
  });

  it("keeps the request body limited to the OTP payload expected by Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requests } = installHttpsRequestMock([{ type: "response", status: 200, body: "" }]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
        redirectTo: "http://localhost:3000/auth/callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = JSON.parse(String(requests[0].write.mock.calls[0][0]));

    expect(payload).toEqual({
      email: "person@serviq.dev",
      create_user: true,
    });
  });

  it("allows the native mobile callback when it is explicitly allowlisted", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.MOBILE_AUTH_REDIRECT_URLS = "serviq://auth-callback";

    const { requestMock } = installHttpsRequestMock([{ type: "response", status: 200, body: "" }]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
        redirectTo: "serviq://auth-callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [options] = requestMock.mock.calls[0];
    const otpUrl = new URL(`https://example.supabase.co${String((options as { path: string }).path)}`);

    expect(otpUrl.searchParams.get("redirect_to")).toBe("serviq://auth-callback");
  });

  it("blocks placeholder or disposable magic-link recipients before sending to Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock } = installHttpsRequestMock([]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "demo@mailinator.com",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "Use a real inbox. Placeholder, disposable, or blocked email addresses cannot receive login links.",
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("supports allowlisting magic-link recipients through environment configuration", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS = "allowed@serviq.in,@trusted.dev";

    const { requestMock } = installHttpsRequestMock([]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "outside@openlane.dev",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "This email address is not approved for magic-link sign-in in this environment.",
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("ignores a mismatched callback host and keeps the current site origin", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock } = installHttpsRequestMock([{ type: "response", status: 200, body: "" }]);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
        redirectTo: "https://app.serviq.example/auth/callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [options] = requestMock.mock.calls[0];
    const otpUrl = new URL(`https://example.supabase.co${String((options as { path: string }).path)}`);

    expect(otpUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
  });

  it("falls back through resolved IPv4 candidates when the hostname request fails", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock } = installHttpsRequestMock([
      { type: "error", error: new Error("primary request failed") },
      { type: "error", error: new Error("first IPv4 failed") },
      { type: "response", status: 200, body: "{}" },
    ]);

    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "2.2.2.2", family: 4 },
    ]);
    vi.spyOn(Resolver.prototype, "resolve4").mockImplementation((_host, callback) => {
      callback(null, ["2.2.2.2", "3.3.3.3"]);
      return {} as never;
    });

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      redirectTo: "http://localhost:3000/auth/callback",
    });
    expect(requestMock).toHaveBeenCalledTimes(3);

    const [directOptions] = requestMock.mock.calls[0];
    const [firstIpv4Options] = requestMock.mock.calls[1];
    const [secondIpv4Options] = requestMock.mock.calls[2];

    expect((directOptions as { hostname: string }).hostname).toBe("example.supabase.co");
    expect((firstIpv4Options as { hostname: string; servername: string; headers: { Host: string } }).hostname).toBe("1.1.1.1");
    expect((firstIpv4Options as { hostname: string; servername: string; headers: { Host: string } }).servername).toBe(
      "example.supabase.co"
    );
    expect((firstIpv4Options as { hostname: string; servername: string; headers: { Host: string } }).headers.Host).toBe(
      "example.supabase.co"
    );
    expect((secondIpv4Options as { hostname: string }).hostname).toBe("2.2.2.2");
  });

  it("returns a 503 when all network strategies fail", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock } = installHttpsRequestMock([{ type: "error", error: new Error("primary request failed") }]);

    vi.spyOn(dnsPromises, "lookup").mockRejectedValue(new Error("system DNS unavailable"));
    vi.spyOn(Resolver.prototype, "resolve4").mockImplementation((_host, callback) => {
      callback(new Error("public DNS unavailable"));
      return {} as never;
    });

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "person@serviq.dev",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      error: "Supabase auth network request failed for example.supabase.co. Check DNS, VPN, firewall, and retry.",
    });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("rate limits repeated magic-link requests for the same email", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requestMock } = installHttpsRequestMock([{ type: "response", status: 200, body: "" }]);

    const createRequest = () =>
      new Request("http://localhost:3000/api/auth/send-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "person@serviq.dev",
        }),
      });

    const firstResponse = await POST(createRequest());
    const secondResponse = await POST(createRequest());
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondResponse.headers.get("Retry-After")).toBeTruthy();
    expect(secondBody).toEqual({
      ok: false,
      error: expect.stringMatching(/^Please wait \d+ seconds before requesting another login link\.$/),
    });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
