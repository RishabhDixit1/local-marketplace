import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
import { withErrorHandling } from "@/lib/server/errorHandler";

async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const flagKey = searchParams.get("key");
  const userId = searchParams.get("userId");

  if (!flagKey) {
    return NextResponse.json({ ok: false, error: "Missing key parameter." }, { status: 400 });
  }

  const enabled = await isFeatureEnabled(flagKey, userId);
  return NextResponse.json({ enabled });
}

export const GET = withErrorHandling(getHandler, "feature-flags:check");
