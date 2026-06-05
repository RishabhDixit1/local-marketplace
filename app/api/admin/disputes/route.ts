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
  const statusFilter = url.searchParams.get("status") || "open";
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  let query = db
    .from("disputes")
    .select("*, orders!inner(consumer_id,provider_id,price,status)")
    .order("created_at", { ascending: false });

  if (["open", "dismissed", "resolved_for_consumer", "resolved_for_provider"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

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

  let body: { id: string; action: "dismiss" | "resolve_for_consumer" | "resolve_for_provider"; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Dispute id is required." }, { status: 400 });
  }

  const resolutionStatus =
    body.action === "dismiss" ? "dismissed" :
    body.action === "resolve_for_consumer" ? "resolved_for_consumer" :
    "resolved_for_provider";

  // Fetch dispute with order info
  const { data: dispute } = await db
    .from("disputes")
    .select("*, orders!inner(id,price,platform_fee_paise,provider_payout_paise,metadata,status)")
    .eq("id", body.id)
    .single<Record<string, unknown>>();

  if (!dispute) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Dispute not found." }, { status: 404 });
  }

  const order = dispute.orders as Record<string, unknown>;

  // Resolve in a transaction-like batch
  const updates: unknown[] = [];

  // 1. Update dispute status
  updates.push(
    db.from("disputes").update({
      status: resolutionStatus,
      resolution_note: body.note ?? null,
      resolved_by: auth.auth.userId,
      resolved_at: new Date().toISOString(),
    }).eq("id", body.id)
  );

  // 2. If resolved for consumer, reverse the provider payout
  if (body.action === "resolve_for_consumer") {
    const orderId = order.id as string;

    // Refund: reset platform_fee and provider_payout to 0 (full refund to consumer)
    updates.push(
      db.from("orders").update({
        platform_fee_paise: 0,
        provider_payout_paise: 0,
        metadata: {
          ...((order.metadata as Record<string, unknown>) ?? {}),
          refunded_via_dispute: true,
          refunded_at: new Date().toISOString(),
          refunded_by: auth.auth.userId,
          original_platform_fee_paise: order.platform_fee_paise,
          original_provider_payout_paise: order.provider_payout_paise,
        },
      }).eq("id", orderId)
    );
  }

  await Promise.all(updates);

  return NextResponse.json({ ok: true, action: resolutionStatus });
}
