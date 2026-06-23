import crypto from "crypto";
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

async function postHandler(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  if (!RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, message: "Payment gateway not configured" }, { status: 503 });
  }

  let body: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    razorpaySubscriptionId?: string;
    planId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.planId) {
    return NextResponse.json({ ok: false, message: "planId is required" }, { status: 400 });
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

  if (body.razorpaySubscriptionId) {
    const { data: existing } = await db
      .from("provider_subscriptions")
      .select("id")
      .eq("razorpay_subscription_id", body.razorpaySubscriptionId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, subscription: existing });
    }

    const { data: razorpaySub } = await db
      .from("razorpay_webhook_events")
      .select("payload")
      .filter("payload->>event", "eq", "subscription.charged")
      .filter("payload->subscription->entity->>id", "eq", body.razorpaySubscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (razorpaySub) {
      return NextResponse.json({ ok: false, message: "Payment not yet confirmed. Please wait a moment and refresh." }, { status: 400 });
    }
  }

  if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
    return NextResponse.json({ ok: false, message: "Missing payment fields for one-time payment" }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== body.razorpaySignature) {
    return NextResponse.json({ ok: false, message: "Payment signature invalid" }, { status: 400 });
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db
    .from("provider_subscriptions")
    .update({ status: "cancelled", cancelled_at: now.toISOString() })
    .eq("provider_id", authResult.auth.userId)
    .eq("status", "active");

  const { data: subscription, error: insertError } = await db
    .from("provider_subscriptions")
    .insert({
      provider_id: authResult.auth.userId,
      plan_id: body.planId,
      status: "active",
      razorpay_order_id: body.razorpayOrderId,
      razorpay_subscription_id: body.razorpaySubscriptionId ?? null,
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

export const POST = withErrorHandling(postHandler, "subscriptions:verify");
