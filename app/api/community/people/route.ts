import { NextResponse } from "next/server";
import type { CommunityPeopleResponse } from "@/lib/api/community";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { loadCommunityPeopleSnapshot } from "@/lib/server/communityData";
import { proxyCommunityPeopleImages } from "@/lib/server/imageProxy";
import { resolveRequestOrigin } from "@/lib/siteUrl";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const requestUrl = new URL(request.url);
  const shouldProxyImages = requestUrl.searchParams.get("imageProxy") === "next";
  const limitParam = requestUrl.searchParams.get("limit");
  const offsetParam = requestUrl.searchParams.get("offset");

  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies CommunityPeopleResponse,
      { status: authResult.status }
    );
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);

  if (!dbClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      } satisfies CommunityPeopleResponse,
      { status: 500 }
    );
  }

  try {
    const limit = limitParam ? Math.max(1, Math.min(5000, Number(limitParam) || 2000)) : undefined;
    const offset = offsetParam ? Math.max(0, Number(offsetParam) || 0) : undefined;

    const cacheKey = queryCacheKey("people", authResult.auth.userId, String(limit ?? 2000), String(offset ?? 0));
    const snapshot = await withCache(
      () => loadCommunityPeopleSnapshot(dbClient, authResult.auth.userId, { limit, offset }),
      { key: cacheKey, ttlSeconds: 60 },
    );

    if (!snapshot) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "People directory unavailable." } satisfies CommunityPeopleResponse,
        { status: 404 }
      );
    }

    const responseSnapshot = shouldProxyImages
      ? proxyCommunityPeopleImages(snapshot, resolveRequestOrigin(request) || requestUrl.origin)
      : snapshot;

    return NextResponse.json(responseSnapshot satisfies CommunityPeopleResponse, {
      headers: {
        "Cache-Control": "private, max-age=0, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[community/people] Failed to load people snapshot:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load people directory.",
      } satisfies CommunityPeopleResponse,
      { status: 500 }
    );
  }
}

export const GET = withErrorHandling(getHandler, "community:people");
