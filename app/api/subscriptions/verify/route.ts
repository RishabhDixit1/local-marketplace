import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  if (!RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, message: "Payment gateway not configured" }, { status: 503 });
  }

  let body: { razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; planId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature || !body.planId) {
    return NextResponse.json({ ok: false, message: "Missing payment fields" }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== body.razorpaySignature) {
    return NextResponse.json({ ok: false, message: "Payment signature invalid" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Server config error" }, { status: 500 });
  }

  const { data: plan } = await db
    .from("subscription_plans")
    .select("*")
    .eq("id", body.planId)
    .single();

  if (!plan) {
    return NextResponse.json({ ok: false, message: "Plan not found" }, { status: 404 });
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Cancel any existing active subscriptions
  await db
    .from("provider_subscriptions")
    .update({ status: "cancelled", cancelled_at: now.toISOString() })
    .eq("provider_id", authResult.auth.userId)
    .eq("status", "active");

  // Create new subscription
  const { data: subscription, error: insertError } = await db
    .from("provider_subscriptions")
    .insert({
      provider_id: authResult.auth.userId,
      plan_id: body.planId,
      status: "active",
      razorpay_order_id: body.razorpayOrderId,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      metadata: {
        razorpay_payment_id: body.razorpayPaymentId,
        paid_at: now.toISOString(),
      },
    })
    .select("*, plan:plan_id(*)")
    .single();

  if (insertError || !subscription) {
    return NextResponse.json({ ok: false, message: insertError?.message ?? "Failed to create subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, subscription });
}
