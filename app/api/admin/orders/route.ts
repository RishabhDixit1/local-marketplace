import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import { createRefund, isRazorpayConfigured } from "@/lib/server/razorpay";
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
  const deliveryStatus = url.searchParams.get("delivery_status") || "";
  const providerId = url.searchParams.get("provider_id") || "";
  const consumerId = url.searchParams.get("consumer_id") || "";
  const fromDate = url.searchParams.get("from") || "";
  const toDate = url.searchParams.get("to") || "";
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const q = url.searchParams.get("q") || "";
  const minAmount = url.searchParams.get("min_amount") || "";
  const maxAmount = url.searchParams.get("max_amount") || "";

  let query = db
    .from("orders")
    .select("id, consumer_id, provider_id, price, status, platform_fee_paise, provider_payout_paise, metadata, created_at, updated_at, listing_type, listing_id, commission_rate")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (deliveryStatus) {
    query = query.contains("metadata", { delivery: { status: deliveryStatus } });
  }

  if (providerId) {
    query = query.eq("provider_id", providerId);
  }

  if (consumerId) {
    query = query.eq("consumer_id", consumerId);
  }

  if (fromDate) {
    query = query.gte("created_at", fromDate);
  }

  if (toDate) {
    query = query.lte("created_at", toDate);
  }

  if (minAmount) {
    query = query.gte("price", parseInt(minAmount, 10));
  }

  if (maxAmount) {
    query = query.lte("price", parseInt(maxAmount, 10));
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

  let body: {
    id: string;
    action: "refund" | "cancel" | "status_override" | "create_payout";
    status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Order id is required." }, { status: 400 });
  }

  const { data: order } = await db
    .from("orders")
    .select("id, price, platform_fee_paise, provider_payout_paise, metadata, status, provider_id, commission_rate")
    .eq("id", body.id)
    .single<Record<string, unknown>>();

  if (!order) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Order not found." }, { status: 404 });
  }

  if (body.action === "refund") {
    const currentMetadata = (order.metadata as Record<string, unknown>) ?? {};
    const razorpayPaymentId = currentMetadata.razorpay_payment_id as string | undefined;
    const pricePaise = order.price != null ? Math.round((order.price as number) * 100) : 0;

    let refundId: string | null = null;
    let refundStatus: string | null = null;

    if (razorpayPaymentId && isRazorpayConfigured()) {
      const refund = await createRefund(razorpayPaymentId, pricePaise, {
        order_id: body.id,
        reason: "Admin refund",
        refunded_by: auth.auth.userId,
      });
      if (refund) {
        refundId = refund.id;
        refundStatus = refund.status;
      }
    }

    await db.from("orders").update({
      status: "cancelled",
      platform_fee_paise: 0,
      provider_payout_paise: 0,
      metadata: {
        ...currentMetadata,
        payment_status: "refunded",
        refund_id: refundId,
        refund_status: refundStatus,
        refunded_at: new Date().toISOString(),
        refunded_by: auth.auth.userId,
        admin_refund: true,
        original_platform_fee_paise: order.platform_fee_paise,
        original_provider_payout_paise: order.provider_payout_paise,
      },
    }).eq("id", body.id);

    return NextResponse.json({ ok: true, refund_id: refundId });
  }

  if (body.action === "cancel") {
    await db.from("orders").update({ status: "cancelled" }).eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "status_override") {
    if (!body.status) {
      return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "status is required for override." }, { status: 400 });
    }

    const currentStatus = order.status as string;

    // Admin override for status transitions that wouldn't normally be allowed
    if (body.status === "cancelled" || body.status === "closed") {
      await db.from("orders").update({
        status: body.status,
        metadata: {
          ...(order.metadata as Record<string, unknown>),
          status_overridden_at: new Date().toISOString(),
          status_overridden_by: auth.auth.userId,
          previous_status: currentStatus,
        },
      }).eq("id", body.id);
      return NextResponse.json({ ok: true });
    }

    // Check normal transition rules for other statuses
    if (currentStatus === "completed" && body.status === "in_progress") {
      return NextResponse.json({ ok: false, message: "Cannot revert from completed." }, { status: 400 });
    }

    await db.from("orders").update({
      status: body.status,
      metadata: {
        ...(order.metadata as Record<string, unknown>),
        status_overridden_at: new Date().toISOString(),
        status_overridden_by: auth.auth.userId,
        previous_status: currentStatus,
      },
    }).eq("id", body.id);

    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_payout") {
    // Create a provider_payout for this order
    const providerId = order.provider_id as string;
    const pricePaise = Math.round((order.price as number) * 100);
    const rate = typeof order.commission_rate === "number" ? order.commission_rate : 5.0;
    const feePaise = Math.round(pricePaise * (rate / 100));
    const netPaise = pricePaise - feePaise;

    const { error: payoutErr } = await db.from("provider_payouts").insert({
      provider_id: providerId,
      amount_paise: pricePaise,
      fee_paise: feePaise,
      net_amount_paise: netPaise,
      status: "pending",
      payout_method: "bank",
      notes: `Admin-triggered payout for order ${body.id}`,
    });

    if (payoutErr) {
      return NextResponse.json({ ok: false, code: "DB", message: payoutErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Unknown action." }, { status: 400 });
}, "admin:orders");
