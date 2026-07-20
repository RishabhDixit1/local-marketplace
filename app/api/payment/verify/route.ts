import crypto from "crypto";
import { NextResponse } from "next/server";
import { normalizeOrderStatus } from "@/lib/orderWorkflow";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import { logger } from "@/lib/server/logger";
import { sendPushToUser } from "@/lib/server/pushNotifications";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

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
  provider_id: string | null;
  price: number | string | null;
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

async function postHandler(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message },
      { status: authResult.status }
    );
  }

  const rateLimitCheck = await applyRateLimit(authResult.auth.userId, "payment:verify", WRITE_ROUTE_CONFIG);
  if (rateLimitCheck.limited) return rateLimitCheck.response;

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

  const sigBuf = Buffer.from(body.razorpaySignature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
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
    .select("id,consumer_id,provider_id,price,status,metadata")
    .in("id", normalizedBody.serviQOrderIds);

  if (error) {
    logger.error("payment:verify", "Failed to load orders for verification", error);
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

    const heldUntil = new Date(Date.now() + 7 * 86400000).toISOString();

    const nextMetadata = {
      ...currentMetadata,
      payment_method: trimText(currentMetadata.payment_method) || "razorpay",
      payment_status: "paid",
      funds_status: "held",
      funds_held_until: heldUntil,
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
      logger.error("payment:verify", "Failed to update order after payment", updateError);
      return NextResponse.json({ ok: false, code: "DB_ERROR", message: "Could not update orders." }, { status: 500 });
    }

    updatedOrders += 1;

    const providerId = order.provider_id;
    if (providerId && providerId !== authResult.auth.userId) {
      try {
        const itemTitle = trimText(currentMetadata.title) || "Order";
        await admin.from("notifications").insert({
          user_id: providerId,
          kind: "order",
          title: "Payment received",
          message: `Razorpay payment for ${itemTitle} is verified. You can continue fulfillment.`,
          entity_type: "order",
          entity_id: order.id,
          metadata: {
            order_id: order.id,
            payment_status: "paid",
            payment_method: "razorpay",
            razorpay_order_id: normalizedBody.razorpayOrderId,
            razorpay_payment_id: normalizedBody.razorpayPaymentId,
            source: "payment_verify",
          },
        });
        await sendPushToUser(admin, providerId, {
          title: "Payment received",
          body: `Razorpay payment for ${itemTitle} is verified.`,
          data: {
            kind: "order",
            entity_type: "order",
            entity_id: order.id,
            order_id: order.id,
            payment_status: "paid",
            source: "payment_verify",
          },
        });
      } catch (err) {
        logger.error("payment:verify", "Notification after payment verification failed", err, { orderId: order.id });
      }
    }
  }

  // Validate Razorpay amount only when orders were actually updated (skip for idempotent replays)
  // Skip when Razorpay is not configured (e.g. test environments)
  if (updatedOrders > 0) {
    try {
      const { isRazorpayConfigured, getRazorpay } = await import("@/lib/server/razorpay");
      if (isRazorpayConfigured()) {
        const razorpay = getRazorpay();
        const rpOrder = await razorpay.orders.fetch(normalizedBody.razorpayOrderId);
        const rpAmountPaise = Number(rpOrder.amount);
        const serviQTotalPaise = orders.reduce(
          (sum, order) => sum + Math.round((Number(order.price) || 0) * 100),
          0,
        );
        if (rpAmountPaise !== serviQTotalPaise) {
          logger.error("payment:verify", "Amount mismatch between Razorpay and ServiQ orders", null, {
            razorpayAmount: rpAmountPaise,
            serviqAmount: serviQTotalPaise,
            orderIds: normalizedBody.serviQOrderIds,
          });
          return NextResponse.json(
            { ok: false, code: "AMOUNT_MISMATCH", message: "Payment amount does not match order total." },
            { status: 400 },
          );
        }
      }
    } catch (err) {
      logger.error("payment:verify", "Failed to validate Razorpay order amount", err);
      return NextResponse.json(
        { ok: false, code: "VERIFICATION_FAILED", message: "Could not verify payment amount." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message: updatedOrders > 0 ? "Payment verified." : "Payment already verified.",
    updatedOrders,
    alreadyVerifiedOrders,
    idempotent: updatedOrders === 0,
  });
}

export const POST = withErrorHandling(postHandler, "payment:verify");
