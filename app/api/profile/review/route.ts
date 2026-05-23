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

  let body: { providerId: string; rating: number; comment?: string };
  try {
    body = await request.json();
  } catch {
    return toError(400, "INVALID_PAYLOAD", "Invalid JSON.");
  }

  const providerId = body.providerId?.trim();
  const rating = Math.max(1, Math.min(5, Math.round(body.rating || 0)));
  const comment = body.comment?.trim() || null;

  if (!providerId) {
    return toError(400, "INVALID_PAYLOAD", "providerId is required.");
  }

  if (providerId === auth.auth.userId) {
    return toError(400, "SELF_REVIEW", "You cannot review yourself.");
  }

  const { error } = await db.from("reviews").insert({
    provider_id: providerId,
    reviewer_id: auth.auth.userId,
    rating,
    comment,
  });

  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true });
}
