import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { orderId: string; providerId: string };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.orderId || !body.providerId) return toError(400, "INVALID_PAYLOAD", "orderId and providerId required.");

  const { data, error } = await db.from("review_requests").upsert({
    order_id: body.orderId,
    provider_id: body.providerId,
    requester_id: auth.auth.userId,
    sent_at: new Date().toISOString(),
  }).select().single();

  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, reviewRequest: data });
}
