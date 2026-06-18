/**
 * Generic cache abstraction.
 *
 * Strategy:
 *   - In production with REDIS_URL, uses ioredis (add `ioredis` to package.json).
 *   - Fallback: in-memory Map with TTL (process-local, not shared across instances).
 *
 * To enable Redis:
 *   1. npm install ioredis
 *   2. Set REDIS_URL in environment
 *   3. The dynamic import below will pick it up automatically.
 */

import type { Redis } from "ioredis";

type CacheEntry = { value: string; expiresAt: number };

let redisClient: Redis | null = null;
let redisAvailable = false;

async function getRedis() {
  if (redisClient) return redisClient;
  if (redisAvailable === false) return null;

  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) {
    redisAvailable = false;
    return null;
  }

  try {
    // Dynamic import to avoid build failure when ioredis is not installed
    const mod = await import("ioredis");
    const Redis = mod.default || mod;
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
      lazyConnect: true,
    });
    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

// ── In-memory fallback ──────────────────────────────────────────────

const memStore = new Map<string, CacheEntry>();
const memCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.expiresAt <= now) memStore.delete(key);
  }
}, 60_000);
// Allow cleanup interval to keep process alive but not prevent exit
if (typeof memCleanup.unref === "function") memCleanup.unref();

// ── Public API ──────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 300,
): Promise<void> {
  const json = JSON.stringify(value);

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, json);
      return;
    } catch {
      // fall through to in-memory
    }
  }

  memStore.set(key, {
    value: json,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      // fall through to in-memory
    }
  }

  memStore.delete(key);
}

export async function cacheClearPattern(pattern: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
      return;
    } catch {
      // fall through to in-memory
    }
  }

  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  for (const key of memStore.keys()) {
    if (regex.test(key)) memStore.delete(key);
  }
}

export function buildCacheKey(...parts: string[]): string {
  return `serviq:${parts.join(":")}`;
}
