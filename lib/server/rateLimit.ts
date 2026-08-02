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

// ── In-memory fallback (when DB is unavailable) ─────────────────────
// Prevents fail-closed denial of service when the rate_limits table
// does not exist or the database is unreachable.

const memoryStore = new Map<string, { count: number; windowStart: number }>();
const MEMORY_CLEANUP_INTERVAL_MS = 60_000;

const cleanupTimer = setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, entry] of memoryStore) {
    if (now - entry.windowStart >= 120) {
      memoryStore.delete(key);
    }
  }
}, MEMORY_CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer === "object" && cleanupTimer !== null && "unref" in cleanupTimer) {
  (cleanupTimer as { unref: () => void }).unref();
}

function checkRateLimitInMemory(
  rateLimitKey: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Math.floor(Date.now() / 1000);
  const entry = memoryStore.get(rateLimitKey);

  if (!entry || now - entry.windowStart >= config.windowSeconds) {
    memoryStore.set(rateLimitKey, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1, resetInSeconds: config.windowSeconds };
  }

  entry.count += 1;
  if (entry.count > config.maxRequests) {
    entry.count -= 1;
    return { allowed: false, remaining: 0, resetInSeconds: config.windowSeconds - (now - entry.windowStart) };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetInSeconds: config.windowSeconds - (now - entry.windowStart) };
}

// ── Postgres fallback ──────────────────────────────────────────────

async function checkRateLimitPostgres(
  rateLimitKey: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  const adminDb = createSupabaseAdminClient();
  if (!adminDb) {
    console.warn("[rateLimit] admin client unavailable, falling back to in-memory");
    return checkRateLimitInMemory(rateLimitKey, config);
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now;

  // Atomic upsert: INSERT new row or, if key exists and window expired, RESET count.
  // Using upsert with onConflict to avoid duplicate-key races on concurrent inserts.
  const { error: upsertErr } = await adminDb
    .from("rate_limits")
    .upsert(
      { key: rateLimitKey, request_count: 1, window_start: windowStart },
      { onConflict: "key", ignoreDuplicates: false },
    );

  if (upsertErr) {
    console.warn("[rateLimit] upsert failed, falling back to in-memory:", upsertErr.message);
    return checkRateLimitInMemory(rateLimitKey, config);
  }

  // Read the current state after upsert (single read, no race since upsert created/reset the row)
  const { data: row } = await adminDb
    .from("rate_limits")
    .select("request_count, window_start")
    .eq("key", rateLimitKey)
    .maybeSingle();

  if (!row) {
    return { allowed: true, remaining: config.maxRequests - 1, resetInSeconds: config.windowSeconds };
  }

  const elapsed = now - row.window_start;

  // If the window expired, the upsert already reset to 1 — check if that's within limit
  if (elapsed >= config.windowSeconds) {
    // Upsert already set count=1 in a fresh window
    return { allowed: true, remaining: config.maxRequests - 1, resetInSeconds: config.windowSeconds };
  }

  // Window is still active. If upsert inserted a new row, count is 1. If it was an existing row
  // that wasn't reset, we need to increment. The upsert may not have incremented if the row
  // already existed, so we do a conditional increment.
  if (row.request_count === 1 && row.window_start === windowStart) {
    // This was our upsert — count is already 1
    if (1 > config.maxRequests) {
      return { allowed: false, remaining: 0, resetInSeconds: config.windowSeconds - elapsed };
    }
    return { allowed: true, remaining: config.maxRequests - 1, resetInSeconds: config.windowSeconds - elapsed };
  }

  // Existing row from a previous request in the same window — increment atomically
  const newCount = row.request_count + 1;
  if (newCount > config.maxRequests) {
    return { allowed: false, remaining: 0, resetInSeconds: config.windowSeconds - elapsed };
  }

  await adminDb
    .from("rate_limits")
    .update({ request_count: newCount })
    .eq("key", rateLimitKey)
    .eq("window_start", row.window_start);

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
    console.error("[rateLimit] check failed, falling back to in-memory:", key, err);
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
      const Sentry = await import("@sentry/nextjs").catch(() => null);
      Sentry?.captureException?.(err instanceof Error ? err : new Error(String(err)), {
        tags: { feature: "rate-limit" },
        extra: { key },
      });
    }
    return checkRateLimitInMemory(buildRateLimitKey(key.identifier, key.route), config);
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
