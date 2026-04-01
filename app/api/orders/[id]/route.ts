import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import type { CanonicalOrderStatus } from "@/lib/orderWorkflow";
import { sendOrderEmail } from "@/lib/email";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<CanonicalOrderStatus>([
  "new_lead", "quoted", "accepted", "in_progress", "completed", "closed", "cancelled", "rejected",
]);

// GET /api/orders/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, message: "Config error." }, { status: 500 });

  const { data, error } = await admin
    .from("orders")
    .select("id,status,price,listing_type,consumer_id,provider_id,metadata,created_at,updated_at,service_listings(title,category),product_catalog(title,category)")
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
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

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
    .select("consumer_id,provider_id,status,price,metadata,listing_type,service_listings(title),product_catalog(title)")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  const ex = existing as unknown as {
    consumer_id: string; provider_id: string | null; status: string; price: number | null;
    metadata: Record<string, unknown>;
    listing_type: string;
    service_listings?: { title: string | null }[] | null;
    product_catalog?: { title: string | null }[] | null;
  };

  if (ex.consumer_id !== authResult.auth.userId && ex.provider_id !== authResult.auth.userId) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  const { error } = await admin
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  // Fire-and-forget email notification
  void (async () => {
    const itemTitle = (ex.listing_type === "service" ? ex.service_listings?.[0]?.title : ex.product_catalog?.[0]?.title)
      ?? (ex.metadata?.title as string | undefined) ?? "Order";

    const emailType =
      status === "accepted" ? "accepted" :
      status === "rejected" ? "rejected" :
      status === "completed" ? "completed" :
      status === "cancelled" ? "cancelled" : null;

    if (!emailType) return;

    // Fetch consumer email
    const { data: consumerUser } = await admin.auth.admin.getUserById(ex.consumer_id);
    const consumerEmail = consumerUser?.user?.email;
    if (consumerEmail) {
      void sendOrderEmail({
        type: emailType,
        to: consumerEmail,
        recipientName: (consumerUser.user?.user_metadata?.name as string | undefined) ?? "there",
        orderId: id,
        itemTitle,
        price: ex.price ?? undefined,
      });
    }
  })();

  return NextResponse.json({ ok: true, status });
}
