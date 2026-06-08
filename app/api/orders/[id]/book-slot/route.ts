import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

type BookSlotBody = {
  scheduled_date: string;
  start_time: string;
  end_time: string;
};

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: orderId } = await params;

  let body: BookSlotBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.scheduled_date || !body.start_time || !body.end_time) {
    return NextResponse.json({ ok: false, message: "scheduled_date, start_time, and end_time required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  // Fetch order
  const { data: order } = await db
    .from("orders")
    .select("id, consumer_id, provider_id, status, metadata")
    .eq("id", orderId)
    .single<{
      id: string; consumer_id: string; provider_id: string | null;
      status: string; metadata: Record<string, unknown> | null;
    }>();

  if (!order) {
    return NextResponse.json({ ok: false, message: "Order not found" }, { status: 404 });
  }

  const userId = auth.auth.userId;
  if (order.consumer_id !== userId && order.provider_id !== userId) {
    return NextResponse.json({ ok: false, message: "Not a party to this order" }, { status: 403 });
  }

  // Conflict check: existing booking for this provider on this date/time
  const { data: conflicts } = await db
    .from("booking_slots")
    .select("id, start_time, end_time")
    .eq("provider_id", order.provider_id)
    .eq("scheduled_date", body.scheduled_date)
    .in("status", ["confirmed"])
    .not("order_id", "eq", orderId);

  if (conflicts) {
    for (const existing of conflicts) {
      if (body.start_time < existing.end_time && body.end_time > existing.start_time) {
        return NextResponse.json({
          ok: false,
          message: "Time slot conflicts with an existing booking",
        }, { status: 409 });
      }
    }
  }

  // Create booking slot
  const { data: booking, error } = await db
    .from("booking_slots")
    .insert({
      order_id: orderId,
      provider_id: order.provider_id,
      consumer_id: order.consumer_id,
      scheduled_date: body.scheduled_date,
      start_time: body.start_time,
      end_time: body.end_time,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // Update order metadata with scheduling info
  const meta = order.metadata ?? {};
  await db.from("orders").update({
    metadata: {
      ...meta,
      scheduled_date: body.scheduled_date,
      scheduled_start: body.start_time,
      scheduled_end: body.end_time,
      fulfillment_status: "scheduled",
    },
  }).eq("id", orderId);

  return NextResponse.json({ ok: true, booking });
}

export const POST = withErrorHandling(postHandler, "orders:book-slot");
