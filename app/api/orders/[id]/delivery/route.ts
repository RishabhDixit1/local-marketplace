import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";
import {
  normalizeDeliveryStatus,
  canTransitionDeliveryStatus,
  getDeliveryStatusLabel,
  createDeliveryMetadata,
  buildDeliveryUpdate,
  type DeliveryInfo,
} from "@/lib/deliveryWorkflow";
import { sendPushToUser } from "@/lib/server/pushNotifications";

export const runtime = "nodejs";

// GET /api/orders/[id]/delivery
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
    .select("consumer_id,provider_id,metadata")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  const row = data as { consumer_id: string; provider_id: string | null; metadata: Record<string, unknown> };
  if (row.consumer_id !== authResult.auth.userId && row.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  const delivery = (row.metadata?.delivery as DeliveryInfo) ?? null;
  return NextResponse.json({ ok: true, delivery });
}

// POST /api/orders/[id]/delivery
async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const { id } = await params;
  let body: { status?: string; driverId?: string; driverName?: string; driverPhone?: string; trackingNumber?: string; carrier?: string; estimatedAt?: string; address?: string; notes?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, message: "Config error." }, { status: 500 });

  const { data, error } = await admin
    .from("orders")
    .select("consumer_id,provider_id,status,metadata")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  const row = data as { consumer_id: string; provider_id: string | null; status: string; metadata: Record<string, unknown> };

  // Only the provider can update delivery tracking
  if (row.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, message: "Only the provider can update delivery." }, { status: 403 });
  }

  const currentDelivery = (row.metadata?.delivery as DeliveryInfo) ?? null;
  const newStatus = body.status ? normalizeDeliveryStatus(body.status) : null;

  let updatedDelivery: DeliveryInfo;

  if (!currentDelivery && newStatus) {
    updatedDelivery = createDeliveryMetadata({
      status: newStatus,
      driverId: body.driverId,
      driverName: body.driverName,
      driverPhone: body.driverPhone,
      trackingNumber: body.trackingNumber,
      carrier: body.carrier,
      estimatedAt: body.estimatedAt,
      address: body.address,
      notes: body.notes,
    });
  } else if (currentDelivery && newStatus) {
    if (!canTransitionDeliveryStatus(currentDelivery.status, newStatus)) {
      return NextResponse.json({
        ok: false,
        message: `Cannot transition from ${currentDelivery.status} to ${newStatus}.`,
      }, { status: 400 });
    }
    const statusLabel = getDeliveryStatusLabel(newStatus);
    const update = buildDeliveryUpdate(currentDelivery, newStatus, {
      ...(body.driverId !== undefined ? { driverId: body.driverId } : {}),
      ...(body.driverName !== undefined ? { driverName: body.driverName } : {}),
      ...(body.driverPhone !== undefined ? { driverPhone: body.driverPhone } : {}),
      ...(body.trackingNumber !== undefined ? { trackingNumber: body.trackingNumber } : {}),
      ...(body.carrier !== undefined ? { carrier: body.carrier } : {}),
      ...(body.estimatedAt !== undefined ? { estimatedAt: body.estimatedAt } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });
    updatedDelivery = update;

    // If delivered → auto-complete the order
    if (newStatus === "delivered") {
      void (async () => {
        try {
          await admin.from("orders").update({
            status: "completed",
            metadata: {
              ...row.metadata,
              delivery: update,
              fulfillment_status: "completed",
              fulfillment_status_label: "Completed, waiting to close",
              fulfillment_updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          }).eq("id", id);

          // Review request
          await admin.from("review_requests").upsert({
            order_id: id,
            provider_id: row.provider_id,
            requester_id: row.consumer_id,
            sent_at: new Date().toISOString(),
            status: "sent",
          }, { onConflict: "order_id, requester_id" });

          // Commission — read price from order
          const { data: orderRow } = await admin.from("orders")
            .select("price,metadata")
            .eq("id", id)
            .single();
          if (orderRow) {
            const p = typeof orderRow.price === "number" ? orderRow.price : 0;
            const pp = Math.round(p * 100);
            const rate = typeof orderRow.metadata?.commission_rate === "number"
              ? (orderRow.metadata.commission_rate as number)
              : 5.0;
            const feePaise = Math.round(pp * (rate / 100));
            const payoutPaise = pp - feePaise;
            await admin.from("orders").update({
              platform_fee_paise: feePaise,
              provider_payout_paise: payoutPaise,
              metadata: {
                ...row.metadata,
                delivery: update,
                commission_calculated_at: new Date().toISOString(),
              },
            }).eq("id", id);

            // Auto-create pending payout
            if (row.provider_id && payoutPaise > 0) {
              const { error: payoutErr } = await admin.from("provider_payouts").insert({
                provider_id: row.provider_id,
                amount_paise: pp,
                fee_paise: feePaise,
                net_amount_paise: payoutPaise,
                status: "pending",
                payout_method: "auto",
                notes: `Auto-payout for order ${id}`,
              });
              if (payoutErr) {
                console.error("[auto-payout] insert failed for order", id, payoutErr.message);
              }
            }
          }
        } catch (err) {
          console.error("[delivery→complete] failed for order", id, err);
        }
      })();
    }

    // Notify consumer
    sendPushToUser(admin, row.consumer_id, {
      title: "Delivery Update",
      body: `${statusLabel}`,
      data: {
        orderId: id,
        type: "delivery_update",
        kind: "order",
        route: `/orders/${id}`,
      },
    }).catch(() => {});
  } else {
    return NextResponse.json({ ok: false, message: "Status is required." }, { status: 400 });
  }

  // Common update (skipped for delivered — auto-complete block already writes)
  if (newStatus !== "delivered") {
    const { error: updateError } = await admin
      .from("orders")
      .update({
        metadata: {
          ...row.metadata,
          delivery: updatedDelivery,
        },
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ ok: false, message: `Update failed: ${updateError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, delivery: updatedDelivery });
}

export const GET = withErrorHandling(getHandler, "delivery:get");
export const POST = withErrorHandling(postHandler, "delivery:post");
