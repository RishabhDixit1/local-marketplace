import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type PresencePingRequest = {
  isOnline?: boolean;
  availability?: string;
  responseSlaMinutes?: number;
};

const recentPings = new Map<string, number>();
const PRESENCE_THROTTLE_MS = 30_000;

setInterval(() => {
  const cutoff = Date.now() - PRESENCE_THROTTLE_MS * 2;
  for (const [userId, ts] of recentPings) {
    if (ts < cutoff) recentPings.delete(userId);
  }
}, PRESENCE_THROTTLE_MS * 2).unref();

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const now = Date.now();
  const lastPing = recentPings.get(authResult.auth.userId);
  if (lastPing && now - lastPing < PRESENCE_THROTTLE_MS) {
    return NextResponse.json({ ok: true, cached: true, providerId: authResult.auth.userId, isOnline: true, timestamp: new Date().toISOString() });
  }
  recentPings.set(authResult.auth.userId, now);

  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const admin = createSupabaseAdminClient();
  const dbClient = userClient || admin;
  if (!dbClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      },
      { status: 500 }
    );
  }

  let body: PresencePingRequest = {};
  try {
    body = (await request.json()) as PresencePingRequest;
  } catch {
    // Optional body. Keep defaults.
  }

  const isOnline = typeof body.isOnline === "boolean" ? body.isOnline : true;
  const availability = typeof body.availability === "string" ? body.availability.trim() : "available";
  const responseSlaMinutes =
    Number.isFinite(body.responseSlaMinutes) && Number(body.responseSlaMinutes) > 0
      ? Number(body.responseSlaMinutes)
      : 15;

  const timestamp = new Date().toISOString();

  const { error } = await dbClient.rpc("upsert_provider_presence", {
    p_is_online: isOnline,
    p_availability: availability || "available",
    p_response_sla_minutes: responseSlaMinutes,
  });

  if (error) {
    const fallbackUpsert = await dbClient
      .from("provider_presence")
      .upsert(
        {
          provider_id: authResult.auth.userId,
          is_online: isOnline,
          availability: availability || "available",
          response_sla_minutes: responseSlaMinutes,
          last_seen: timestamp,
        },
        { onConflict: "provider_id" }
      );

    if (fallbackUpsert.error) {
      const message = fallbackUpsert.error.message || error.message || "Failed to update presence.";
      // Presence ping is best-effort — return 200 even on schema issues to avoid console noise
      return NextResponse.json({
        ok: false,
        code: "DB",
        message,
        providerId: authResult.auth.userId,
        isOnline,
        availability: availability || "available",
        responseSlaMinutes,
        timestamp,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    providerId: authResult.auth.userId,
    isOnline,
    availability: availability || "available",
    responseSlaMinutes,
    timestamp,
  });
}
