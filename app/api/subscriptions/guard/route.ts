import { NextResponse } from "next/server";
import { getSubscriptionTier } from "@/lib/server/subscriptionGuard";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const { tier, name, active } = await getSubscriptionTier(request);
  return NextResponse.json({ ok: true, tier, name, active });
}

export const GET = withErrorHandling(getHandler, "subscriptions:guard");
