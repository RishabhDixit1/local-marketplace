import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const { data, error } = await db
    .from("feed_card_feedback")
    .select("id,user_id,card_id,focus_id,reason,metadata,created_at")
    .contains("metadata", { dispute: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, disputes: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  let body: { id: string; action: "dismiss" | "resolve_for_consumer" | "resolve_for_provider" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Dispute id is required." }, { status: 400 });
  }

  const resolutionKey = body.action === "dismiss" ? "dismissed" :
    body.action === "resolve_for_consumer" ? "resolved_for_consumer" : "resolved_for_provider";

  const { data: dispute } = await db
    .from("feed_card_feedback")
    .select("metadata")
    .eq("id", body.id)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>();

  if (!dispute) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Dispute not found." }, { status: 404 });
  }

  const { error } = await db.from("feed_card_feedback").update({
    metadata: { ...(dispute.metadata ?? {}), status: resolutionKey, resolved_at: new Date().toISOString() },
  }).eq("id", body.id);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: resolutionKey });
}
