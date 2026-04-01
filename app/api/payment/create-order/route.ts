import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

type CreatePaymentOrderBody = {
  amount: number; // INR paise (1 rupee = 100 paise)
  receipt: string;
  notes?: Record<string, string>;
};

function isValidBody(body: unknown): body is CreatePaymentOrderBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.amount === "number" && b.amount > 0 && typeof b.receipt === "string";
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message },
      { status: authResult.status }
    );
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
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

  try {
    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

    const order = await razorpay.orders.create({
      amount: Math.round(body.amount), // must be integer paise
      currency: "INR",
      receipt: body.receipt.slice(0, 40),
      notes: body.notes ?? {},
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment gateway error.";
    console.error("[api/payment/create-order]", msg);
    return NextResponse.json({ ok: false, code: "GATEWAY_ERROR", message: msg }, { status: 502 });
  }
}
