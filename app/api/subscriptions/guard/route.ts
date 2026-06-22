import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { getSubscriptionTier } from "@/lib/server/subscriptionGuard";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { tier, name, active } = await getSubscriptionTier(request);
  return NextResponse.json({ ok: true, tier, name, active });
}

export const GET = withErrorHandling(getHandler, "subscriptions:guard");
