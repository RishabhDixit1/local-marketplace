import { cacheGet, cacheSet, buildCacheKey, cacheClearPattern } from "./cache";

type CacheOptions = {
  ttlSeconds?: number;
  key: string;
};

const NULL_PLACEHOLDER = "__NULL__";

export async function withCache<T>(
  fn: () => Promise<T>,
  opts: CacheOptions,
): Promise<T> {
  const cached = await cacheGet<string>(opts.key);
  if (cached != null) {
    if (cached === NULL_PLACEHOLDER) return null as unknown as T;
    return cached as unknown as T;
  }

  const result = await fn();

  await cacheSet(
    opts.key,
    result ?? NULL_PLACEHOLDER,
    opts.ttlSeconds ?? 300,
  );

  return result;
}

export function queryCacheKey(namespace: string, ...parts: string[]): string {
  return buildCacheKey("query", namespace, ...parts);
}

export { cacheClearPattern as invalidatePattern };
