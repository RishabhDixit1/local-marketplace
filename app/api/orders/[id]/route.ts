import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import { logger } from "@/lib/server/logger";
import type { CanonicalOrderStatus, OrderActorRole } from "@/lib/orderWorkflow";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { canTransitionOrderStatus, getOrderStatusLabel } from "@/lib/orderWorkflow";
import { sendOrderEmail, shouldSkipOrderEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/server/pushNotifications";
import { createRefund, isRazorpayConfigured } from "@/lib/server/razorpay";
import { transitionLinkedPostStatus } from "@/lib/postStatus";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<CanonicalOrderStatus>([
  "new_lead", "quoted", "accepted", "in_progress", "completed", "closed", "cancelled", "rejected",
]);

const fulfillmentForStatus = (status: CanonicalOrderStatus) => {
  switch (status) {
    case "accepted":
      return {
        fulfillment_status: "confirmed",
        fulfillment_status_label: "Confirmed by both sides",
      };
    case "in_progress":
      return {
        fulfillment_status: "in_progress",
        fulfillment_status_label: "Fulfillment in progress",
      };
    case "completed":
      return {
        fulfillment_status: "completed",
        fulfillment_status_label: "Completed, waiting to close",
      };
    case "closed":
      return {
        fulfillment_status: "closed",
        fulfillment_status_label: "Closed",
      };
    case "cancelled":
      return {
        fulfillment_status: "cancelled",
        fulfillment_status_label: "Cancelled",
      };
    case "rejected":
      return {
        fulfillment_status: "rejected",
        fulfillment_status_label: "Rejected",
      };
    case "quoted":
      return {
        fulfillment_status: "quote_sent",
        fulfillment_status_label: "Quote sent",
      };
    case "new_lead":
    default:
      return {
        fulfillment_status: "provider_review_pending",
        fulfillment_status_label: "Waiting for provider review",
      };
  }
};

// GET /api/orders/[id]
async function getHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, message: "Config error." }, { status: 500 });

  const { data, error } = await admin
    .from("orders")
    .select("id,status,price,listing_type,consumer_id,provider_id,metadata,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  // Only the consumer or provider can view
  const row = data as { consumer_id: string; provider_id: string | null };
  if (row.consumer_id !== authResult.auth.userId && row.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, order: data });
}

// PATCH /api/orders/[id]  — status transition
async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const rateLimitCheck = await applyRateLimit(authResult.auth.userId, "orders:update", WRITE_ROUTE_CONFIG);
  if (rateLimitCheck.limited) return rateLimitCheck.response;

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }

  const { status } = body as { status?: unknown };
  if (typeof status !== "string" || !VALID_STATUSES.has(status as CanonicalOrderStatus)) {
    return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, message: "Config error." }, { status: 500 });

  // Verify caller is consumer or provider of this order
  const { data: existing } = await admin
    .from("orders")
    .select("id,consumer_id,provider_id,status,price,metadata,listing_type")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  const ex = existing as unknown as {
    id: string; consumer_id: string; provider_id: string | null; status: string; price: number | null;
    metadata: Record<string, unknown>;
    listing_type: string;
  };

  if (ex.consumer_id !== authResult.auth.userId && ex.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  // Enforce role-based transition rules
  const actor: OrderActorRole = ex.consumer_id === authResult.auth.userId ? "consumer" : "provider";
  if (!canTransitionOrderStatus({ from: ex.status, to: status, actor })) {
    return NextResponse.json(
      { ok: false, code: "TRANSITION_DENIED", message: `Transition from '${ex.status}' to '${status}' is not allowed for role '${actor}'.` },
      { status: 400 }
    );
  }

  const previousStatus = ex.status;

  const { error } = await admin
    .from("orders")
    .update({
      status,
      metadata: {
        ...(ex.metadata || {}),
        ...fulfillmentForStatus(status as CanonicalOrderStatus),
        fulfillment_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  // Transition linked post status (non-blocking)
  transitionLinkedPostStatus({
    db: admin,
    orderId: id,
    newOrderStatus: status,
    actorId: authResult.auth.userId,
  }).catch((err) => {
    logger.error("orders:update", "Linked post status sync failed", err, { orderId: id, newStatus: status });
  });

  const otherUserId = actor === "consumer" ? ex.provider_id : ex.consumer_id;
  if (otherUserId) {
    void (async () => {
      try {
        const itemTitle = (ex.metadata?.title as string | undefined) ?? "Order";
        const statusLabel = getOrderStatusLabel(status);
        const message =
          actor === "consumer"
            ? `The customer marked ${itemTitle} as ${statusLabel}.`
            : `The provider marked ${itemTitle} as ${statusLabel}.`;

        await admin.from("notifications").insert({
          user_id: otherUserId,
          kind: "order",
          title: `Order ${statusLabel}`,
          message,
          entity_type: "order",
          entity_id: id,
          metadata: {
            order_id: id,
            status,
            status_label: statusLabel,
            title: itemTitle,
            source: "order_status",
          },
        });

        await sendPushToUser(admin, otherUserId, {
          title: `Order ${statusLabel}`,
          body: message,
          data: {
            kind: "order",
            entity_type: "order",
            entity_id: id,
            order_id: id,
            status,
            status_label: statusLabel,
            title: itemTitle,
            source: "order_status",
          },
        });
      } catch (err) {
        logger.error("orders:update", "Status notification failed", err, { orderId: id });
      }
    })();
  }

  let bookingWarning: string | undefined;

  // If cancelled, propagate to linked booking slot (non-blocking)
  if (status === "cancelled") {
    try {
      const { data: linkedBooking, error: bookingLookupErr } = await admin
        .from("booking_slots")
        .select("id, status")
        .eq("order_id", id)
        .in("status", ["confirmed", "rescheduled"])
        .limit(1)
        .maybeSingle();

      if (bookingLookupErr) {
        logger.error("orders:update", "Booking slot lookup failed", bookingLookupErr, { orderId: id });
        bookingWarning = "Order cancelled but linked booking lookup failed. Please contact support.";
      } else if (linkedBooking) {
        const { error: bookingUpdateErr } = await admin
          .from("booking_slots")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", linkedBooking.id);

        if (bookingUpdateErr) {
          logger.error("orders:update", "Booking slot cancel sync failed", bookingUpdateErr, { orderId: id, bookingId: linkedBooking.id });
          bookingWarning = "Order cancelled but linked booking sync failed. Please contact support.";
        }
      }
    } catch (err) {
      logger.error("orders:update", "Booking slot cancel sync failed", err, { orderId: id });
      bookingWarning = "Order cancelled but linked booking sync failed. Please contact support.";
    }
  }

  let refundWarning: string | undefined;

  // If cancelled, process refund for paid orders
  if (status === "cancelled") {
    try {
      const meta = ex.metadata || {};
      const paymentStatus = meta.payment_status as string | undefined;
      const razorpayPaymentId = meta.razorpay_payment_id as string | undefined;

      if (paymentStatus === "paid" && razorpayPaymentId && isRazorpayConfigured()) {
        const pricePaise = ex.price != null ? Math.round(ex.price * 100) : 0;

        if (pricePaise <= 0) {
          logger.error("orders:update", "Cannot refund order with zero/null price", null, { orderId: id, price: ex.price });
          refundWarning = "Order cancelled but refund could not be processed: order has no valid price. Please contact support.";
        } else {
          const refund = await createRefund(razorpayPaymentId, pricePaise, {
            order_id: id,
            reason: `Order cancelled (status transition from ${previousStatus})`,
          });

          if (refund.ok) {
            await admin.from("orders").update({
              metadata: {
                ...meta,
                payment_status: "refunded",
                refund_id: refund.id,
                refund_status: refund.status,
                refunded_at: new Date().toISOString(),
              },
            }).eq("id", id);
          } else {
            logger.error("orders:update", "Razorpay refund failed", refund.error, { orderId: id, paymentId: razorpayPaymentId });
            refundWarning = "Order cancelled but refund processing failed. Please contact support.";
          }
        }
      }
    } catch (err) {
      logger.error("orders:update", "Refund processing failed", err, { orderId: id });
      refundWarning = "Order cancelled but refund processing failed. Please contact support.";
    }
  }

  let payoutWarning: string | undefined;

  // Auto-create review request + commission + payout on completion
  if (status === "completed") {
    try {
      await admin.from("review_requests").upsert({
        order_id: id,
        provider_id: ex.provider_id,
        requester_id: ex.consumer_id,
        sent_at: new Date().toISOString(),
        status: "sent",
      }, { onConflict: "order_id, requester_id" });
    } catch (err) {
      logger.error("orders:update", "Review request creation failed", err, { orderId: id });
      payoutWarning = "Review request creation failed.";
    }

    try {
      const pricePaise = ex.price != null ? Math.round(ex.price * 100) : 0;
      const rate = typeof ex.metadata?.commission_rate === "number" ? ex.metadata.commission_rate : 5.0;
      const feePaise = Math.round(pricePaise * (rate / 100));
      const payoutPaise = pricePaise - feePaise;

      await admin.from("orders").update({
        platform_fee_paise: feePaise,
        provider_payout_paise: payoutPaise,
        metadata: {
          ...(ex.metadata || {}),
          commission_calculated_at: new Date().toISOString(),
        },
      }).eq("id", id);

      if (ex.provider_id && payoutPaise > 0) {
        const { error: payoutErr } = await admin.from("provider_payouts").insert({
          provider_id: ex.provider_id,
          amount_paise: pricePaise,
          fee_paise: feePaise,
          net_amount_paise: payoutPaise,
          status: "pending",
          payout_method: "auto",
          notes: `Auto-payout for order ${id}`,
        });

        if (payoutErr) {
          logger.error("orders:update", "Auto-payout insert failed", payoutErr, { orderId: id });
          payoutWarning = "Payout creation failed. Please contact support.";
        }
      }
    } catch (err) {
      logger.error("orders:update", "Commission/payout calculation failed", err, { orderId: id });
      payoutWarning = "Commission calculation failed. Please contact support.";
    }
  }

  // Fire-and-forget email notifications (with error capture)
  void (async () => {
    try {
      const itemTitle = (ex.metadata?.title as string | undefined) ?? "Order";

      const emailType =
        status === "accepted" ? "accepted" :
        status === "rejected" ? "rejected" :
        status === "completed" ? "completed" :
        status === "cancelled" ? "cancelled" : null;

      if (!emailType) return;

      const [consumerUser, providerUser] = await Promise.all([
        admin.auth.admin.getUserById(ex.consumer_id).catch(() => null),
        ex.provider_id ? admin.auth.admin.getUserById(ex.provider_id).catch(() => null) : null,
      ]);

      const consumerEmail = consumerUser?.data?.user?.email;
      const providerEmail = providerUser?.data?.user?.email;
      const consumerName = (consumerUser?.data?.user?.user_metadata?.name as string | undefined) ?? "there";
      const providerName = (providerUser?.data?.user?.user_metadata?.name as string | undefined) ?? undefined;

      const [consumerSkip, providerSkip] = await Promise.all([
        shouldSkipOrderEmail(ex.consumer_id),
        ex.provider_id ? shouldSkipOrderEmail(ex.provider_id) : Promise.resolve(false),
      ]);

      if (consumerEmail && !consumerSkip) {
        await sendOrderEmail({
          type: emailType,
          to: consumerEmail,
          recipientName: consumerName,
          orderId: id,
          itemTitle,
          price: ex.price ?? undefined,
          providerName,
        });
      }

      // Notify provider for consumer-initiated status changes (completed, cancelled)
      if (providerEmail && (status === "completed" || status === "cancelled") && actor === "consumer" && !providerSkip) {
        await sendOrderEmail({
          type: emailType === "completed" ? "completed" : "cancelled",
          to: providerEmail,
          recipientName: providerName ?? "there",
          orderId: id,
          itemTitle,
          price: ex.price ?? undefined,
          consumerName,
        });
      }
    } catch (err) {
      logger.error("orders:update", "Status email sending failed", err, { orderId: id });
    }
  })();

  // Fire-and-forget SMS notifications via Twilio
  void (async () => {
    try {
      const { sendOrderSmsNotifications } = await import("@/lib/server/orderSmsNotifications");
      await sendOrderSmsNotifications({
        id: ex.id,
        consumer_id: ex.consumer_id,
        provider_id: ex.provider_id,
        status: status,
        price: ex.price,
      }, previousStatus);
    } catch (err) {
      logger.error("orders:update", "Status SMS sending failed", err, { orderId: id });
    }
  })();

  return NextResponse.json({
    ok: !refundWarning && !payoutWarning && !bookingWarning,
    status,
    ...(bookingWarning ? { bookingWarning } : {}),
    ...(refundWarning ? { refundWarning } : {}),
    ...(payoutWarning ? { payoutWarning } : {}),
  });
}

export const GET = withErrorHandling(getHandler, "orders:get");
export const PATCH = withErrorHandling(patchHandler, "orders:update");
