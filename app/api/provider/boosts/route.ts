import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { getProviderSubscription, hasFeature } from "@/lib/server/subscriptionCheck";

export const runtime = "nodejs";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

const BOOST_PRICES: Record<string, { label: string; days: number; pricePaise: number }> = {
  "7": { label: "7 days", days: 7, pricePaise: 19900 },
  "30": { label: "30 days", days: 30, pricePaise: 49900 },
};

// GET — list active placements for the current provider
export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { data: placements } = await db
    .from("featured_placements")
    .select("id, listing_id, starts_at, ends_at, active, price_paise, created_at, placement_type")
    .eq("provider_id", authResult.auth.userId)
    .order("created_at", { ascending: false });

  const now = new Date().toISOString();
  const active = (placements ?? []).filter(
    (p) => p.active && p.starts_at <= now && p.ends_at >= now
  );
  const upcoming = (placements ?? []).filter((p) => p.starts_at > now);
  const expired = (placements ?? []).filter(
    (p) => !p.active || p.ends_at < now
  );

  return NextResponse.json({
    ok: true,
    active,
    upcoming,
    expired,
    remainingBoosts: 10 - active.length,
    plans: BOOST_PRICES,
  });
}

// POST — create a Razorpay order for a boost
export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, message: "Payment gateway not configured" }, { status: 503 });
  }

  let body: { duration: string; listingId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const boost = BOOST_PRICES[body.duration];
  if (!boost) {
    return NextResponse.json({ ok: false, message: "Invalid duration. Use '7' or '30'." }, { status: 400 });
  }

  // Check subscription — boosts are Premium-only (10/mo)
  const sub = await getProviderSubscription(authResult.auth.userId);
  if (!sub.active || !hasFeature(sub, "Boost promotions")) {
    return NextResponse.json({
      ok: false,
      message: "Boost promotions require a Premium subscription",
    }, { status: 403 });
  }

  // Check remaining boost count
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const now = new Date().toISOString();
  const { count: activeBoostCount } = await db
    .from("featured_placements")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", authResult.auth.userId)
    .eq("active", true)
    .lte("starts_at", now)
    .gte("ends_at", now);

  const boostLimit = 10;
  if ((activeBoostCount ?? 0) >= boostLimit) {
    return NextResponse.json({
      ok: false,
      message: `You have reached the maximum of ${boostLimit} active boosts. Wait for some to expire.`,
    }, { status: 403 });
  }

  try {
    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

    const order = await razorpay.orders.create({
      amount: boost.pricePaise,
      currency: "INR",
      receipt: `boost_${authResult.auth.userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        provider_id: authResult.auth.userId,
        duration: body.duration,
        listing_id: body.listingId ?? "",
        type: "boost",
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      duration: body.duration,
      days: boost.days,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment gateway error";
    console.error("[api/provider/boosts]", msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}
