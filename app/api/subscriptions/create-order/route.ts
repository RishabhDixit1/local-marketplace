import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { getRazorpay, isRazorpayConfigured } from "@/lib/server/razorpay";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ ok: false, message: "Payment gateway not configured" }, { status: 503 });
  }

  let body: { planId?: string };
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

  const { data: plan, error: planError } = await db
    .from("subscription_plans")
    .select("*")
    .eq("id", body.planId)
    .eq("active", true)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ ok: false, message: "Plan not found" }, { status: 404 });
  }

  if (plan.price_paise <= 0) {
    return NextResponse.json({ ok: false, message: "Free plans cannot be purchased" }, { status: 400 });
  }

  try {
    const razorpay = getRazorpay();

    if (plan.razorpay_plan_id) {
      const subscription = await razorpay.subscriptions.create({
        plan_id: plan.razorpay_plan_id,
        customer_notify: true,
        total_count: 100,
        notes: {
          provider_id: authResult.auth.userId,
          plan_id: body.planId,
          plan_name: plan.name,
        },
      });

      return NextResponse.json({
        ok: true,
        subscriptionId: subscription.id,
        amount: plan.price_paise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID ?? "",
        plan,
      });
    }

    const order = await razorpay.orders.create({
      amount: plan.price_paise,
      currency: "INR",
      receipt: `sub_${authResult.auth.userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        provider_id: authResult.auth.userId,
        plan_id: body.planId,
        plan_name: plan.name,
        type: "subscription",
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
      plan,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment gateway error";
    console.error("[api/subscriptions/create-order]", msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}

export const POST = withErrorHandling(postHandler, "subscriptions:create-order");
