import { NextResponse } from "next/server";
import { getCoordinates } from "@/lib/geo";
import type { CommunityFeedResponse } from "@/lib/api/community";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { loadCommunityFeedSnapshot } from "@/lib/server/communityData";
import { proxyCommunityFeedImages } from "@/lib/server/imageProxy";
import { resolveRequestOrigin } from "@/lib/siteUrl";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const requestUrl = new URL(request.url);
  const viewerCoordinates = getCoordinates(requestUrl.searchParams.get("lat"), requestUrl.searchParams.get("lng"));
  const scope = requestUrl.searchParams.get("scope") === "connected" ? "connected" : "all";
  const shouldProxyImages = requestUrl.searchParams.get("imageProxy") === "next";

  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      } satisfies CommunityFeedResponse,
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
      } satisfies CommunityFeedResponse,
      { status: 500 }
    );
  }

  try {
    const cacheKey = queryCacheKey("feed", authResult.auth.userId, scope);
    const snapshot = await withCache(
      () => loadCommunityFeedSnapshot(dbClient, authResult.auth.userId, {
        viewerOverride: viewerCoordinates ? { lat: viewerCoordinates.latitude, lng: viewerCoordinates.longitude } : null,
        scope,
      }),
      { key: cacheKey, ttlSeconds: 30 },
    );

    if (!snapshot) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Feed unavailable." } satisfies CommunityFeedResponse,
        { status: 404 }
      );
    }

    const responseSnapshot = shouldProxyImages
      ? proxyCommunityFeedImages(snapshot, resolveRequestOrigin(request) || requestUrl.origin)
      : snapshot;

    return NextResponse.json(responseSnapshot satisfies CommunityFeedResponse, {
      headers: {
        "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load community feed.",
      } satisfies CommunityFeedResponse,
      { status: 500 }
    );
  }
}

export const GET = withErrorHandling(getHandler, "community:feed");
