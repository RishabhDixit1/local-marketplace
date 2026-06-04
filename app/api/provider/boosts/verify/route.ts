import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

const BOOST_DAYS: Record<string, number> = {
  "7": 7,
  "30": 30,
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, message: "Payment gateway not configured" }, { status: 503 });
  }

  let body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; duration: string; listingId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, duration, listingId } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !duration) {
    return NextResponse.json({ ok: false, message: "Missing payment verification fields" }, { status: 400 });
  }

  // Verify signature
  const text = `${razorpay_order_id}|${razorpay_payment_id}`;
  const crypto = await import("node:crypto");
  const generatedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(text)
    .digest("hex");

  if (generatedSignature !== razorpay_signature) {
    return NextResponse.json({ ok: false, message: "Payment verification failed — signature mismatch" }, { status: 403 });
  }

  // Verify the order exists and was paid
  const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  let order;
  try {
    order = await razorpay.orders.fetch(razorpay_order_id);
  } catch {
    return NextResponse.json({ ok: false, message: "Order not found on Razorpay" }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json({ ok: false, message: "Order is not paid" }, { status: 402 });
  }

  const days = BOOST_DAYS[duration];
  if (!days) {
    return NextResponse.json({ ok: false, message: "Invalid duration" }, { status: 400 });
  }

  // Activate the placement
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + days);

  const { data: placement, error } = await db
    .from("featured_placements")
    .insert({
      provider_id: authResult.auth.userId,
      listing_id: listingId || null,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      placement_type: "feed_boost",
      active: true,
      price_paise: order.amount,
      payment_id: razorpay_payment_id,
      razorpay_order_id,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/provider/boosts/verify] insert error", error);
    return NextResponse.json({ ok: false, message: "Failed to activate boost" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    placement,
  });
}
