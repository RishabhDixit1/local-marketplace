import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

type VerifyBody = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  /** ServiQ internal order IDs created from /api/orders */
  serviQOrderIds: string[];
};

function isValidBody(body: unknown): body is VerifyBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.razorpayOrderId === "string" &&
    typeof b.razorpayPaymentId === "string" &&
    typeof b.razorpaySignature === "string" &&
    Array.isArray(b.serviQOrderIds) &&
    b.serviQOrderIds.length > 0
  );
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message },
      { status: authResult.status }
    );
  }

  if (!RAZORPAY_KEY_SECRET) {
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
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Missing fields." }, { status: 400 });
  }

  // Verify Razorpay HMAC signature
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== body.razorpaySignature) {
    return NextResponse.json(
      { ok: false, code: "SIGNATURE_MISMATCH", message: "Payment signature invalid." },
      { status: 400 }
    );
  }

  // Mark all linked ServiQ orders as accepted + store payment IDs
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "Server error." }, { status: 500 });
  }

  const { error } = await admin
    .from("orders")
    .update({
      status: "accepted",
      metadata: {
        payment_status: "paid",
        razorpay_order_id: body.razorpayOrderId,
        razorpay_payment_id: body.razorpayPaymentId,
        paid_at: new Date().toISOString(),
      },
    })
    .in("id", body.serviQOrderIds)
    .eq("consumer_id", authResult.auth.userId);

  if (error) {
    console.error("[api/payment/verify] update error:", error.message);
    return NextResponse.json({ ok: false, code: "DB_ERROR", message: "Could not update orders." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Payment verified." });
}
