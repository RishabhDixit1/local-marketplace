import { NextResponse } from "next/server";
import { getCoordinates } from "@/lib/geo";
import type { CommunityFeedResponse } from "@/lib/api/community";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { loadCommunityFeedSnapshot } from "@/lib/server/communityData";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const viewerCoordinates = getCoordinates(requestUrl.searchParams.get("lat"), requestUrl.searchParams.get("lng"));
  const scope = requestUrl.searchParams.get("scope") === "connected" ? "connected" : "all";

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
    const snapshot = await loadCommunityFeedSnapshot(dbClient, authResult.auth.userId, {
      viewerOverride: viewerCoordinates ? { lat: viewerCoordinates.latitude, lng: viewerCoordinates.longitude } : null,
      scope,
    });
    return NextResponse.json(snapshot satisfies CommunityFeedResponse, {
      headers: {
        "Cache-Control": "no-store",
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
