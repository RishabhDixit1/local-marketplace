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

  return NextResponse.json({ ok: true, status: "cancelled" });
}

export const POST = withErrorHandling(postHandler, "bookings:cancel");
