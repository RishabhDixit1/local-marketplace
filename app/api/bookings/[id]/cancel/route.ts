import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { createRefund, isRazorpayConfigured } from "@/lib/server/razorpay";

export const runtime = "nodejs";

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: bookingId } = await params;

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { data: existing } = await db
    .from("booking_slots")
    .select("*")
    .eq("id", bookingId)
    .single<{
      id: string; order_id: string; provider_id: string; consumer_id: string;
      status: string; notes: string | null;
    }>();

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Booking not found" }, { status: 404 });
  }

  const userId = auth.auth.userId;
  if (existing.consumer_id !== userId && existing.provider_id !== userId) {
    return NextResponse.json({ ok: false, message: "Not authorized" }, { status: 403 });
  }

  if (existing.status === "cancelled") {
    return NextResponse.json({ ok: false, message: "Booking is already cancelled" }, { status: 409 });
  }

  if (existing.status === "completed") {
    return NextResponse.json({ ok: false, message: "Completed bookings cannot be cancelled" }, { status: 409 });
  }

  const { error } = await db
    .from("booking_slots")
    .update({
      status: "cancelled",
      notes: body.reason || existing.notes || null,
    })
    .eq("id", bookingId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // Propagate cancellation to parent order
  if (existing.order_id) {
    void (async () => {
      try {
        const { data: order } = await db
          .from("orders")
          .select("id, status, price, metadata")
          .eq("id", existing.order_id)
          .single<{ id: string; status: string; price: number | null; metadata: Record<string, unknown> }>();

        if (order && order.status !== "cancelled" && order.status !== "closed") {
          const meta = order.metadata || {};
          const razorpayPaymentId = meta.razorpay_payment_id as string | undefined;
          const paymentStatus = meta.payment_status as string | undefined;

          await db.from("orders").update({
            status: "cancelled",
            metadata: {
              ...meta,
              cancelled_via_booking: true,
              cancelled_booking_id: bookingId,
            },
            updated_at: new Date().toISOString(),
          }).eq("id", existing.order_id);

          // Refund if paid
          if (paymentStatus === "paid" && razorpayPaymentId && isRazorpayConfigured()) {
            const amountPaise = order.price != null ? Math.round(order.price * 100) : 0;
            const refund = await createRefund(razorpayPaymentId, amountPaise, {
              order_id: existing.order_id,
              reason: "Booking cancelled",
            });
            if (refund) {
              await db.from("orders").update({
                platform_fee_paise: 0,
                provider_payout_paise: 0,
                metadata: {
                  ...meta,
                  cancelled_via_booking: true,
                  cancelled_booking_id: bookingId,
                  payment_status: "refunded",
                  refund_id: refund.id,
                  refund_status: refund.status,
                  refunded_at: new Date().toISOString(),
                },
              }).eq("id", existing.order_id);
            }
          }
        }
      } catch (err) {
        console.error("[booking-cancel] failed to update parent order", existing.order_id, err);
      }
    })();
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}

export const POST = withErrorHandling(postHandler, "bookings:cancel");
