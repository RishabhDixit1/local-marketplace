import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { getGoogleAuthUrl } from "@/lib/server/oauth/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=unauthorized", request.url)
    );
  }

  const url = new URL(request.url);
  const state = JSON.stringify({
    userId: auth.auth.userId,
    redirectTo: url.searchParams.get("redirect") || "/dashboard/settings",
  });

  const googleUrl = getGoogleAuthUrl(state);
  return NextResponse.redirect(googleUrl);
}
