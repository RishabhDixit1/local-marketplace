import crypto from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";
export const preferredRegion = "auto";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

if (typeof globalThis !== "undefined" && !WEBHOOK_SECRET) {
  console.warn("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set — webhook verification will reject all requests");
}

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

type RazorpayWebhookPayload = {
  event: string;
  event_id?: string;
  contains?: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        fee: number | null;
        notes?: Record<string, string>;
        created_at: number;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
        created_at: number;
      };
    };
    order?: {
      entity: {
        id: string;
        status: string;
        amount: number;
        notes?: Record<string, string>;
      };
    };
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        status: string;
        current_start: number;
        current_end: number;
        charge_at: number;
        notes?: Record<string, string>;
        created_at: number;
      };
    };
    payout?: {
      entity: {
        id: string;
        status: string;
        fund_account_id: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
        created_at: number;
      };
    };
  };
};

async function postHandler(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifySignature(bodyText, signature)) {
    return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(bodyText) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const eventId = event.event_id ?? `evt_${Date.now()}`;

  // Idempotency check
  const { data: existing } = await db
    .from("razorpay_webhook_events")
    .select("id, status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, message: "Already processed", eventId });
  }

  // Log the event
  const { error: logError } = await db.from("razorpay_webhook_events").insert({
    event_id: eventId,
    event_type: event.event,
    payload: event,
    order_id: event.payload.payment?.entity.order_id ?? event.payload.refund?.entity.order_id ?? null,
    status: "processing",
  });

  if (logError) {
    return NextResponse.json({ ok: false, message: logError.message }, { status: 500 });
  }

  try {
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment?.entity;
        if (!payment) break;

        const razorpayOrderId = payment.order_id;
        const razorpayPaymentId = payment.id;

        // Find ServiQ orders linked to this Razorpay order
        const { data: orders } = await db
          .from("orders")
          .select("id, status, metadata")
          .filter("metadata->>razorpay_order_id", "eq", razorpayOrderId);

        if (orders) {
          for (const order of orders) {
            const meta = (order.metadata as Record<string, unknown>) ?? {};

            // Only update if still processing/pending
            if (meta.payment_status === "paid") continue;

            const nextStatus = order.status === "new_lead" || order.status === "quoted" ? "accepted" : order.status;

            await db
              .from("orders")
              .update({
                status: nextStatus,
                metadata: {
                  ...meta,
                  payment_status: "paid",
                  razorpay_order_id: razorpayOrderId,
                  razorpay_payment_id: razorpayPaymentId,
                  paid_at: new Date(payment.created_at * 1000).toISOString(),
                },
              })
              .eq("id", order.id);
          }
        }
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment?.entity;
        if (!payment) break;

        const { data: orders } = await db
          .from("orders")
          .select("id, metadata")
          .filter("metadata->>razorpay_order_id", "eq", payment.order_id);

        if (orders) {
          for (const order of orders) {
            const meta = (order.metadata as Record<string, unknown>) ?? {};
            await db
              .from("orders")
              .update({
                metadata: {
                  ...meta,
                  payment_status: "failed",
                  payment_error: `Razorpay: ${payment.status}`,
                },
              })
              .eq("id", order.id);
          }
        }
        break;
      }

      case "refund.created": {
        const refund = event.payload.refund?.entity;
        if (!refund) break;

        const { data: orders } = await db
          .from("orders")
          .select("id, metadata")
          .filter("metadata->>razorpay_payment_id", "eq", refund.payment_id);

        if (orders) {
          for (const order of orders) {
            const meta = (order.metadata as Record<string, unknown>) ?? {};
            const refunds = Array.isArray(meta.refunds) ? [...meta.refunds] : [];
            refunds.push({
              refund_id: refund.id,
              amount_paise: refund.amount,
              status: refund.status,
              created_at: new Date(refund.created_at * 1000).toISOString(),
            });

            await db
              .from("orders")
              .update({
                metadata: {
                  ...meta,
                  refunds,
                },
              })
              .eq("id", order.id);
          }
        }
        break;
      }

      case "subscription.charged": {
        const sub = event.payload.subscription?.entity;
        if (!sub) break;

        const razorpaySubId = sub.id;
        const { data: existingSub } = await db
          .from("provider_subscriptions")
          .select("id, status, current_period_end")
          .eq("razorpay_subscription_id", razorpaySubId)
          .maybeSingle();

        if (existingSub) {
          const periodEnd = sub.current_end
            ? new Date(sub.current_end * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await db
            .from("provider_subscriptions")
            .update({
              status: "active",
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSub.id);
        }
        break;
      }

      case "payout.created":
      case "payout.processed": {
        const payoutEntity = event.payload.payout?.entity;
        if (!payoutEntity) break;

        await db
          .from("provider_payouts")
          .update({ status: "completed", razorpay_payout_id: payoutEntity.id })
          .eq("razorpay_payout_id", payoutEntity.id);

        await db
          .from("referral_payouts")
          .update({ status: "completed", razorpay_payout_id: payoutEntity.id })
          .eq("razorpay_payout_id", payoutEntity.id);
        break;
      }

      case "payout.failed": {
        const failedPayout = event.payload.payout?.entity;
        if (!failedPayout) break;

        await db
          .from("provider_payouts")
          .update({ status: "failed", razorpay_payout_id: failedPayout.id })
          .eq("razorpay_payout_id", failedPayout.id);

        await db
          .from("referral_payouts")
          .update({ status: "failed", razorpay_payout_id: failedPayout.id })
          .eq("razorpay_payout_id", failedPayout.id);
        break;
      }

      case "subscription.completed":
      case "subscription.paused": {
        const subEnd = event.payload.subscription?.entity;
        if (!subEnd) break;

        await db
          .from("provider_subscriptions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("razorpay_subscription_id", subEnd.id)
          .eq("status", "active");
        break;
      }

      default:
        break;
    }

    // Mark webhook event as processed
    await db
      .from("razorpay_webhook_events")
      .update({ status: "processed" })
      .eq("event_id", eventId);

    return NextResponse.json({ ok: true, eventId });
  } catch (err) {
    await db
      .from("razorpay_webhook_events")
      .update({ status: "failed" })
      .eq("event_id", eventId);

    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Processing error" }, { status: 500 });
  }
}

export const POST = withErrorHandling(postHandler, "webhooks:razorpay");
