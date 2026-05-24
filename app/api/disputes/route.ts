import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: { orderId: string; reason: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.orderId || !body.reason) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "orderId and reason are required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const { data: order } = await db
    .from("orders")
    .select("id,consumer_id,provider_id,status,metadata")
    .eq("id", body.orderId)
    .single<{
      id: string; consumer_id: string; provider_id: string | null;
      status: string; metadata: Record<string, unknown> | null;
    }>();

  if (!order) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Order not found." }, { status: 404 });
  }

  if (order.consumer_id !== auth.auth.userId && order.provider_id !== auth.auth.userId) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "You are not a party to this order." }, { status: 403 });
  }

  const { error } = await db.from("feed_card_feedback").insert({
    user_id: auth.auth.userId,
    card_id: body.orderId,
    focus_id: order.provider_id,
    card_type: "service",
    feedback_type: "report",
    reason: `dispute: ${body.reason}`,
    metadata: {
      dispute: true,
      order_id: body.orderId,
      reason: body.reason,
      description: body.description ?? null,
      status: "open",
    },
  });

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
