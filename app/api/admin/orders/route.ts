import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";

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
  const statusFilter = url.searchParams.get("status") || "";
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const q = url.searchParams.get("q") || "";

  let query = db
    .from("orders")
    .select("id, consumer_id, provider_id, price, status, platform_fee_paise, provider_payout_paise, metadata, created_at, updated_at, listing_type, listing_id")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (q) {
    query = query.or(`id.ilike.%${q}%,consumer_id.ilike.%${q}%,provider_id.ilike.%${q}%`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orders: data ?? [],
    count,
    limit,
    offset,
  });
}

export const PATCH = withErrorHandling(async (request: Request) => {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const rateLimit = await applyRateLimit(auth.auth.userId, "admin:orders", WRITE_ROUTE_CONFIG);
  if (rateLimit.limited) return rateLimit.response;

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  let body: { id: string; action: "refund" | "cancel" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Order id is required." }, { status: 400 });
  }

  if (body.action === "refund") {
    const { data: order } = await db
      .from("orders")
      .select("id, price, platform_fee_paise, provider_payout_paise, metadata, status")
      .eq("id", body.id)
      .single<Record<string, unknown>>();

    if (!order) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Order not found." }, { status: 404 });
    }

    const currentMetadata = (order.metadata as Record<string, unknown>) ?? {};

    await db.from("orders").update({
      status: "cancelled",
      platform_fee_paise: 0,
      provider_payout_paise: 0,
      metadata: {
        ...currentMetadata,
        payment_status: "refunded",
        refunded_at: new Date().toISOString(),
        refunded_by: auth.auth.userId,
        admin_refund: true,
        original_platform_fee_paise: order.platform_fee_paise,
        original_provider_payout_paise: order.provider_payout_paise,
      },
    }).eq("id", body.id);
  }

  if (body.action === "cancel") {
    await db.from("orders").update({ status: "cancelled" }).eq("id", body.id);
  }

  return NextResponse.json({ ok: true });
}, "admin:orders");
