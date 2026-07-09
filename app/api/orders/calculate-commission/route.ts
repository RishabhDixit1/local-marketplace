import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  let body: { orderId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "orderId required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const { data: order } = await db
    .from("orders")
    .select("id,price,status,commission_rate,platform_fee_paise,provider_payout_paise,user_id,provider_id")
    .eq("id", body.orderId)
    .single();

  if (!order) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Order not found." }, { status: 404 });
  }

  if (order.user_id !== authResult.auth.userId && order.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Not authorized to access this order." }, { status: 403 });
  }

  const o = order as {
    price: number | null;
    status: string;
    commission_rate: number | null;
    platform_fee_paise: number | null;
    provider_payout_paise: number | null;
  };

  if (o.status !== "completed") {
    return NextResponse.json({ ok: false, code: "NOT_COMPLETED", message: "Order is not completed." }, { status: 400 });
  }

  if (o.platform_fee_paise != null && o.provider_payout_paise != null) {
    return NextResponse.json({
      ok: true,
      alreadyCalculated: true,
      platformFeePaise: o.platform_fee_paise,
      providerPayoutPaise: o.provider_payout_paise,
      commissionRate: o.commission_rate,
    });
  }

  const pricePaise = o.price != null ? Math.round(o.price * 100) : 0;
  const rate = o.commission_rate ?? 5.0;
  const feePaise = Math.round(pricePaise * (rate / 100));
  const payoutPaise = pricePaise - feePaise;

  const { error } = await db.from("orders").update({
    platform_fee_paise: feePaise,
    provider_payout_paise: payoutPaise,
  }).eq("id", body.orderId);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    platformFeePaise: feePaise,
    providerPayoutPaise: payoutPaise,
    commissionRate: rate,
  });
}
