import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { NextResponse } from "next/server";

type RateLimitConfig = {
  windowSeconds: number;
  maxRequests: number;
};

const DEFAULT_CONFIG: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 30,
};

const AUTH_ROUTE_CONFIG: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 5,
};

const WRITE_ROUTE_CONFIG: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 20,
};

type RateLimitKey = {
  identifier: string;
  route: string;
};

const buildRateLimitKey = (identifier: string, route: string): string =>
  `ratelimit:${identifier}:${route}`;

export const checkRateLimit = async (
  key: RateLimitKey,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> => {
  try {
    const adminDb = createSupabaseAdminClient();
    if (!adminDb) {
      return { allowed: true, remaining: 999, resetInSeconds: 0 };
    }

    const now = Math.floor(Date.now() / 1000);
    const rateLimitKey = buildRateLimitKey(key.identifier, key.route);

    const { data: existing } = await adminDb
      .from("rate_limits")
      .select("request_count, window_start")
      .eq("key", rateLimitKey)
      .maybeSingle();

    if (!existing) {
      await adminDb.from("rate_limits").insert({
        key: rateLimitKey,
        request_count: 1,
        window_start: now,
      });

      return { allowed: true, remaining: config.maxRequests - 1, resetInSeconds: config.windowSeconds };
    }

    const elapsed = now - existing.window_start;
    if (elapsed >= config.windowSeconds) {
      await adminDb
        .from("rate_limits")
        .update({ request_count: 1, window_start: now })
        .eq("key", rateLimitKey);

      return { allowed: true, remaining: config.maxRequests - 1, resetInSeconds: config.windowSeconds };
    }

    const newCount = existing.request_count + 1;
    if (newCount > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: config.windowSeconds - elapsed,
      };
    }

    await adminDb
      .from("rate_limits")
      .update({ request_count: newCount })
      .eq("key", rateLimitKey);

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetInSeconds: config.windowSeconds - elapsed,
    };
  } catch {
    console.error("Rate limit check failed, allowing request (fail-open):", key);
    return { allowed: true, remaining: 999, resetInSeconds: 0 };
  }
};

export const rateLimitResponse = (resetInSeconds: number) =>
  NextResponse.json(
    {
      ok: false,
      code: "RATE_LIMITED",
      message: `Too many requests. Try again in ${resetInSeconds} second${resetInSeconds === 1 ? "" : "s"}.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetInSeconds),
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + resetInSeconds),
      },
    },
  );

type ApplyRateLimitResult =
  | { limited: true; response: NextResponse }
  | { limited: false; response: null };

export const applyRateLimit = async (
  userId: string | null,
  route: string,
  config?: RateLimitConfig,
): Promise<ApplyRateLimitResult> => {
  const identifier = userId || "anonymous";
  const result = await checkRateLimit({ identifier, route }, config);

  if (!result.allowed) {
    return { limited: true, response: rateLimitResponse(result.resetInSeconds) };
  }

  return { limited: false, response: null };
};

export { AUTH_ROUTE_CONFIG, WRITE_ROUTE_CONFIG, DEFAULT_CONFIG };
