import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { normalizeOrderStatus } from "@/lib/orderWorkflow";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message },
      { status: authResult.status }
    );
  }

  const { id } = await params;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Payment gateway not configured." },
      { status: 503 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "Server error." }, { status: 500 });
  }

  const { data: order, error: loadError } = await admin
    .from("orders")
    .select("id,consumer_id,price,status,metadata")
    .eq("id", id)
    .single();

  if (loadError || !order) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Order not found." }, { status: 404 });
  }

  if (order.consumer_id !== authResult.auth.userId) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "You do not have access to this order." },
      { status: 403 }
    );
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  if (normalizedStatus !== "payment_failed") {
    return NextResponse.json(
      { ok: false, code: "INVALID_STATE", message: "Only orders with payment_failed status can retry payment." },
      { status: 400 }
    );
  }

  const price = typeof order.price === "number" && order.price > 0 ? order.price : null;
  if (!price) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PRICE", message: "Order does not have a valid price." },
      { status: 400 }
    );
  }

  const amountPaise = Math.round(price * 100);

  try {
    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `retry_${id}_${Date.now()}`.slice(0, 40),
      notes: {
        order_id: id,
        retry: "true",
      },
    });

    const currentMetadata = (order.metadata as Record<string, unknown>) ?? {};

    const { error: updateError } = await admin
      .from("orders")
      .update({
        metadata: {
          ...currentMetadata,
          razorpay_order_id: razorpayOrder.id,
          payment_status: "pending",
        },
      })
      .eq("id", id);

    if (updateError) {
      console.error("[api/retry-payment] metadata update error:", updateError.message);
      return NextResponse.json(
        { ok: false, code: "DB_ERROR", message: "Could not update order metadata." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment gateway error.";
    console.error("[api/retry-payment]", msg);
    return NextResponse.json({ ok: false, code: "GATEWAY_ERROR", message: msg }, { status: 502 });
  }
}

export const POST = withErrorHandling(postHandler, "orders:retry-payment");
