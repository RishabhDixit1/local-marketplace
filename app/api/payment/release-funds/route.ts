import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { data: heldOrders, error: fetchError } = await db
    .from("orders")
    .select("id, metadata")
    .in("status", ["completed", "closed"])
    .filter("metadata->>funds_status", "eq", "held")
    .filter("metadata->>funds_held_until", "lt", now);

  if (fetchError) {
    return NextResponse.json({ ok: false, message: fetchError.message }, { status: 500 });
  }

  let released = 0;
  const failedOrderIds: string[] = [];
  for (const order of heldOrders ?? []) {
    const meta =
      typeof order.metadata === "object" && order.metadata !== null
        ? (order.metadata as Record<string, unknown>)
        : {};

    const { error: updateError } = await db
      .from("orders")
      .update({
        metadata: {
          ...meta,
          funds_status: "available",
          funds_released_at: now,
        },
      })
      .eq("id", order.id);

    if (!updateError) {
      released++;
    } else {
      failedOrderIds.push(order.id);
    }
  }

  return NextResponse.json({
    ok: true,
    released,
    total: (heldOrders ?? []).length,
    ...(failedOrderIds.length > 0 ? { failedOrderIds } : {}),
  });
}

export const POST = withErrorHandling(postHandler, "payment:release-funds");
