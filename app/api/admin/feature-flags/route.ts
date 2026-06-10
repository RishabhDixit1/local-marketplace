import { NextResponse } from "next/server";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";
import { getAllFeatureFlags, setFeatureFlag } from "@/lib/feature-flags/server";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }
  const flags = await getAllFeatureFlags();
  return NextResponse.json({ flags });
}

export const PATCH = withErrorHandling(async (request: Request) => {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const rateLimit = await applyRateLimit(auth.auth.userId, "admin:feature-flags", WRITE_ROUTE_CONFIG);
  if (rateLimit.limited) return rateLimit.response;

  try {
    const body = (await request.json()) as { key: string; enabled: boolean; description?: string };
    if (!body.key) {
      return NextResponse.json({ ok: false, error: "Missing key." }, { status: 400 });
    }
    await setFeatureFlag(body.key, body.enabled, body.description);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}, "admin:feature-flags");
