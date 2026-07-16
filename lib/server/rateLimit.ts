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
  maxRequests: 10,
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

// ── Redis (preferred) ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisInstance = any;

let redisClient: RedisInstance | null = null;
let redisChecked = false;

async function getRedis(): Promise<RedisInstance | null> {
  if (redisChecked) return redisClient;
  redisChecked = true;

  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;

  try {
    const mod = await import("ioredis");
    const RedisImpl = mod.default || mod;
    redisClient = new RedisImpl(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

async function checkRateLimitRedis(
  rateLimitKey: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number } | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const windowStart = now - windowMs;

    // Sliding window: count requests in the last windowMs using sorted sets
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(rateLimitKey, 0, windowStart);
    pipe.zadd(rateLimitKey, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
    pipe.zcard(rateLimitKey);
    pipe.expire(rateLimitKey, config.windowSeconds);
    const results = await pipe.exec();

    if (!results) return null;

    const count = results[2]?.[1] as number | undefined;
    if (count == null) return null;

    const currentCount = count;
    if (currentCount > config.maxRequests) {
      // Remove the request we just added (it was denied)
      await redis.zremrangebyscore(rateLimitKey, now, now).catch(() => {});
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: config.windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount,
      resetInSeconds: config.windowSeconds,
    };
  } catch {
    // Redis unavailable — fall through to Postgres
    return null;
  }
}

// ── Postgres fallback ──────────────────────────────────────────────

async function checkRateLimitPostgres(
  rateLimitKey: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  const adminDb = createSupabaseAdminClient();
  if (!adminDb) {
    console.error("[rateLimit] admin client unavailable, denying request (fail-closed)");
    return { allowed: false, remaining: 0, resetInSeconds: config.windowSeconds };
  }

  const now = Math.floor(Date.now() / 1000);

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
}

// ── Unified entry point ────────────────────────────────────────────

export const checkRateLimit = async (
  key: RateLimitKey,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> => {
  try {
    const rateLimitKey = buildRateLimitKey(key.identifier, key.route);

    // Try Redis first (fast, shared across instances)
    const redisResult = await checkRateLimitRedis(rateLimitKey, config);
    if (redisResult !== null) return redisResult;

    // Fall back to Postgres
    return await checkRateLimitPostgres(rateLimitKey, config);
  } catch (err) {
    console.error("[rateLimit] check failed, denying request (fail-closed):", key, err);
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
      const Sentry = await import("@sentry/nextjs").catch(() => null);
      Sentry?.captureException?.(err instanceof Error ? err : new Error(String(err)), {
        tags: { feature: "rate-limit" },
        extra: { key },
      });
    }
    return { allowed: false, remaining: 0, resetInSeconds: config.windowSeconds };
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
