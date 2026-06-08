import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request) {
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

  // Verify order exists and user is a party
  const { data: order } = await db
    .from("orders")
    .select("id,consumer_id,provider_id,status")
    .eq("id", body.orderId)
    .single<{ id: string; consumer_id: string; provider_id: string | null; status: string }>();

  if (!order) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Order not found." }, { status: 404 });
  }

  if (order.consumer_id !== auth.auth.userId && order.provider_id !== auth.auth.userId) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "You are not a party to this order." }, { status: 403 });
  }

  // Check for existing open dispute on this order
  const { count: existing } = await db
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("order_id", body.orderId)
    .eq("status", "open");

  if (existing && existing > 0) {
    return NextResponse.json({ ok: false, code: "CONFLICT", message: "An open dispute already exists for this order." }, { status: 409 });
  }

  const { data: dispute, error } = await db
    .from("disputes")
    .insert({
      order_id: body.orderId,
      filed_by: auth.auth.userId,
      reason: body.reason,
      description: body.description ?? null,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dispute });
}

export const POST = withErrorHandling(postHandler, "disputes:create");
