import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/auth/send-link/route";

describe("POST /api/auth/send-link", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    vi.restoreAllMocks();

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
  });

  it("forwards the requested callback using the redirect_to query parameter", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }) as Response);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        redirectTo: "http://localhost:3000/auth/callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String((init as RequestInit).body));
    const otpUrl = new URL(String(url));

    expect(otpUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
    expect(payload.redirect_to).toBeUndefined();
    expect(payload.email_redirect_to).toBeUndefined();
  });

  it("uses the incoming request origin when no callback is provided", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }) as Response);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [url] = fetchMock.mock.calls[0];
    const otpUrl = new URL(String(url));

    expect(otpUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
  });

  it("keeps the request body limited to the OTP payload expected by Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }) as Response);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        redirectTo: "http://localhost:3000/auth/callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String((init as RequestInit).body));

    expect(payload).toEqual({
      email: "user@example.com",
      create_user: true,
    });
  });

  it("ignores a mismatched callback host and keeps the current site origin", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }) as Response);

    const request = new Request("http://localhost:3000/api/auth/send-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        redirectTo: "https://local-marketplace-eta.vercel.app/auth/callback",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [url] = fetchMock.mock.calls[0];
    const otpUrl = new URL(String(url));

    expect(otpUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
  });
});
