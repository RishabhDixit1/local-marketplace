import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: bookingId } = await params;

  let body: { scheduled_date: string; start_time: string; end_time: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.scheduled_date || !body.start_time || !body.end_time) {
    return NextResponse.json({ ok: false, message: "scheduled_date, start_time, and end_time required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { data: existing } = await db
    .from("booking_slots")
    .select("*")
    .eq("id", bookingId)
    .single<{
      id: string; order_id: string; provider_id: string; consumer_id: string;
      status: string; scheduled_date: string; start_time: string; end_time: string;
      notes: string | null;
    }>();

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Booking not found" }, { status: 404 });
  }

  const userId = auth.auth.userId;
  if (existing.consumer_id !== userId && existing.provider_id !== userId) {
    return NextResponse.json({ ok: false, message: "Not authorized" }, { status: 403 });
  }

  if (existing.status !== "confirmed") {
    return NextResponse.json({ ok: false, message: "Only confirmed bookings can be rescheduled" }, { status: 409 });
  }

  // Check slot availability for new time
  const { data: available } = await db.rpc("check_booking_slot_available", {
    p_provider_id: existing.provider_id,
    p_scheduled_date: body.scheduled_date,
    p_start_time: body.start_time,
    p_end_time: body.end_time,
  });

  if (available === false) {
    return NextResponse.json({ ok: false, message: "The requested time slot is not available" }, { status: 409 });
  }

  // Mark old booking as rescheduled
  await db.from("booking_slots").update({ status: "rescheduled" }).eq("id", bookingId);

  // Create new booking
  const { data: newBooking, error } = await db
    .from("booking_slots")
    .insert({
      order_id: existing.order_id,
      provider_id: existing.provider_id,
      consumer_id: existing.consumer_id,
      scheduled_date: body.scheduled_date,
      start_time: body.start_time,
      end_time: body.end_time,
      status: "confirmed",
      rescheduled_from_id: bookingId,
      notes: existing.notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // Update order metadata
  await db.from("orders").update({
    metadata: {
      scheduled_date: body.scheduled_date,
      scheduled_start: body.start_time,
      scheduled_end: body.end_time,
      rescheduled_from: bookingId,
      rescheduled_at: new Date().toISOString(),
    },
  }).eq("id", existing.order_id);

  return NextResponse.json({ ok: true, booking: newBooking });
}

export const POST = withErrorHandling(postHandler, "bookings:reschedule");
