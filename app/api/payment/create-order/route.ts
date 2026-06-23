import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { getRazorpay, isRazorpayConfigured } from "@/lib/server/razorpay";

export const runtime = "nodejs";

type CreatePaymentOrderBody = {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
  promoCode?: string;
};

function isValidBody(body: unknown): body is CreatePaymentOrderBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.amount === "number" && b.amount > 0 && typeof b.receipt === "string";
}

async function postHandler(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message },
      { status: authResult.status }
    );
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Payment gateway not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid JSON." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "amount (paise) and receipt are required." },
      { status: 400 }
    );
  }

  let discountPaise = 0;
  let promoData: Record<string, unknown> | null = null;

  if (body.promoCode) {
    const db = createSupabaseAdminClient();
    if (db) {
      const { data: validation } = await db.rpc("validate_promo_code", {
        p_code: body.promoCode,
        p_order_paise: body.amount,
      });

      if (validation?.ok) {
        discountPaise = validation.discount_paise;
        promoData = {
          promo_code_id: validation.promo_code_id,
          promo_code: validation.code,
          discount_paise: validation.discount_paise,
        };
      }
    }
  }

  const finalAmount = Math.max(Math.round(body.amount - discountPaise), 0);

  if (finalAmount <= 0) {
    return NextResponse.json({
      ok: true,
      orderId: null,
      amount: 0,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
      paid: true,
      discountPaise,
      promo: promoData,
    });
  }

  try {
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: finalAmount,
      currency: "INR",
      receipt: body.receipt.slice(0, 40),
      notes: {
        ...(body.notes ?? {}),
        ...(promoData ? { promo_code: String(promoData.promo_code), discount_paise: String(discountPaise) } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
      discountPaise,
      promo: promoData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment gateway error.";
    console.error("[api/payment/create-order]", msg);
    return NextResponse.json({ ok: false, code: "GATEWAY_ERROR", message: msg }, { status: 502 });
  }
}

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  return NextResponse.json({ ok: false, message: "Not implemented." }, { status: 501 });
}

export const GET = withErrorHandling(getHandler, "payment:create-order");
export const POST = withErrorHandling(postHandler, "payment:create-order");
