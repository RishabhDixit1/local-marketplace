import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { syncGoogleBusinessProfile } from "@/lib/server/oauth/google";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });
  }

  const result = await syncGoogleBusinessProfile(auth.auth.userId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, synced: result.synced });
}
