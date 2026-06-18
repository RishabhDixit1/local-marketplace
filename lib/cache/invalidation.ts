import { cacheClearPattern, buildCacheKey } from "./cache";

export async function invalidateUserFeed(userId: string): Promise<void> {
  await cacheClearPattern(buildCacheKey("query", "feed", userId, "*"));
}

export async function invalidateUserPeople(userId: string): Promise<void> {
  await cacheClearPattern(buildCacheKey("query", "people", userId, "*"));
}

export async function invalidateLocalities(): Promise<void> {
  await cacheClearPattern(buildCacheKey("query", "localities", "*"));
}

export async function invalidateServiceCategories(): Promise<void> {
  await cacheClearPattern(buildCacheKey("query", "service-categories", "*"));
}

export async function invalidateAdminStats(): Promise<void> {
  await cacheClearPattern(buildCacheKey("query", "admin-stats"));
}
