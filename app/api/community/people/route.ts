import { NextResponse } from "next/server";
import type { CommunityPeopleResponse } from "@/lib/api/community";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { loadCommunityPeopleSnapshot } from "@/lib/server/communityData";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    const snapshot = await loadCommunityPeopleSnapshot(dbClient, authResult.auth.userId);
    return NextResponse.json(snapshot satisfies CommunityPeopleResponse, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
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
