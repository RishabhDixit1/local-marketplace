import crypto from "crypto";
import { NextResponse } from "next/server";
import { normalizeOrderStatus } from "@/lib/orderWorkflow";
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

type OrderPaymentRow = {
  id: string;
  consumer_id: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

const trimText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toMetadata = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const dedupeOrderIds = (value: string[]) => Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));

const hasPaymentConflict = (metadata: Record<string, unknown>, body: VerifyBody) => {
  const existingOrderId = trimText(metadata.razorpay_order_id);
  const existingPaymentId = trimText(metadata.razorpay_payment_id);

  if (!existingOrderId && !existingPaymentId) return false;
  if (existingOrderId && existingOrderId !== body.razorpayOrderId) return true;
  if (existingPaymentId && existingPaymentId !== body.razorpayPaymentId) return true;
  return false;
};

function isValidBody(body: unknown): body is VerifyBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.razorpayOrderId === "string" &&
    b.razorpayOrderId.trim().length > 0 &&
    typeof b.razorpayPaymentId === "string" &&
    b.razorpayPaymentId.trim().length > 0 &&
    typeof b.razorpaySignature === "string" &&
    b.razorpaySignature.trim().length > 0 &&
    Array.isArray(b.serviQOrderIds) &&
    b.serviQOrderIds.some((item) => typeof item === "string" && item.trim().length > 0)
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

  const normalizedBody: VerifyBody = {
    razorpayOrderId: body.razorpayOrderId.trim(),
    razorpayPaymentId: body.razorpayPaymentId.trim(),
    razorpaySignature: body.razorpaySignature.trim(),
    serviQOrderIds: dedupeOrderIds(body.serviQOrderIds),
  };

  if (normalizedBody.serviQOrderIds.length === 0) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Missing order IDs." }, { status: 400 });
  }

  // Mark linked ServiQ orders as paid while preserving their existing metadata and workflow state.
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "Server error." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("orders")
    .select("id,consumer_id,status,metadata")
    .in("id", normalizedBody.serviQOrderIds);

  if (error) {
    console.error("[api/payment/verify] load error:", error.message);
    return NextResponse.json({ ok: false, code: "DB_ERROR", message: "Could not load orders for verification." }, { status: 500 });
  }

  const orders = (data as OrderPaymentRow[] | null) || [];
  if (orders.length !== normalizedBody.serviQOrderIds.length) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "One or more orders could not be found." }, { status: 404 });
  }

  if (orders.some((order) => order.consumer_id !== authResult.auth.userId)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "You do not have access to these orders." }, { status: 403 });
  }

  const conflictingOrder = orders.find((order) => hasPaymentConflict(toMetadata(order.metadata), normalizedBody));
  if (conflictingOrder) {
    return NextResponse.json(
      {
        ok: false,
        code: "PAYMENT_CONFLICT",
        message: "These orders are already linked to a different payment reference.",
      },
      { status: 409 }
    );
  }

  const paidAt = new Date().toISOString();
  let updatedOrders = 0;
  let alreadyVerifiedOrders = 0;

  for (const order of orders) {
    const currentMetadata = toMetadata(order.metadata);
    const currentPaymentStatus = trimText(currentMetadata.payment_status).toLowerCase();
    const alreadyVerified =
      currentPaymentStatus === "paid" &&
      trimText(currentMetadata.razorpay_order_id) === normalizedBody.razorpayOrderId &&
      trimText(currentMetadata.razorpay_payment_id) === normalizedBody.razorpayPaymentId;

    if (alreadyVerified) {
      alreadyVerifiedOrders += 1;
      continue;
    }

    const normalizedStatus = normalizeOrderStatus(order.status);
    const nextStatus =
      normalizedStatus === "new_lead" || normalizedStatus === "quoted"
        ? "accepted"
        : trimText(order.status) || normalizedStatus;

    const nextMetadata = {
      ...currentMetadata,
      payment_method: trimText(currentMetadata.payment_method) || "razorpay",
      payment_status: "paid",
      razorpay_order_id: normalizedBody.razorpayOrderId,
      razorpay_payment_id: normalizedBody.razorpayPaymentId,
      paid_at: trimText(currentMetadata.paid_at) || paidAt,
    };

    const { error: updateError } = await admin
      .from("orders")
      .update({
        status: nextStatus,
        metadata: nextMetadata,
      })
      .eq("id", order.id)
      .eq("consumer_id", authResult.auth.userId);

    if (updateError) {
      console.error("[api/payment/verify] update error:", updateError.message);
      return NextResponse.json({ ok: false, code: "DB_ERROR", message: "Could not update orders." }, { status: 500 });
    }

    updatedOrders += 1;
  }

  return NextResponse.json({
    ok: true,
    message: updatedOrders > 0 ? "Payment verified." : "Payment already verified.",
    updatedOrders,
    alreadyVerifiedOrders,
    idempotent: updatedOrders === 0,
  });
}
