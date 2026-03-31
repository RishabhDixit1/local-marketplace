import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type OrderRequest = {
  providerId: string;
  itemType: "service" | "product";
  itemId: string;
  price: number;
  quantity?: number;
  title?: string;
};

type BulkOrderRequest = {
  items: OrderRequest[];
};

function isOrderRequest(body: unknown): body is OrderRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.providerId === "string" &&
    (b.itemType === "service" || b.itemType === "product") &&
    typeof b.itemId === "string" &&
    typeof b.price === "number" &&
    b.price >= 0
  );
}

function isBulkOrderRequest(body: unknown): body is BulkOrderRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  return b.items.every((item) => isOrderRequest(item));
}

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message },
      { status: authResult.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!isOrderRequest(body) && !isBulkOrderRequest(body)) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        message: "Missing or invalid fields. Send either a single order payload or { items: [...] }.",
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Server configuration error." },
      { status: 500 }
    );
  }

  const requestedItems = isBulkOrderRequest(body) ? body.items : [body];

  const rowsToInsert: Record<string, unknown>[] = requestedItems.map((item) => {
    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    const insert: Record<string, unknown> = {
      consumer_id: authResult.auth.userId,
      provider_id: item.providerId,
      listing_type: item.itemType,
      price: item.price,
      status: "new_lead",
      metadata: {
        source: "cart",
        quantity,
        title: item.title || "",
      },
    };

    if (item.itemType === "service") {
      insert.service_id = item.itemId;
      insert.listing_id = item.itemId;
    } else {
      insert.product_id = item.itemId;
      insert.listing_id = item.itemId;
    }

    return insert;
  });

  const { data, error } = await admin.from("orders").insert(rowsToInsert).select("id");

  if (error) {
    console.error("[api/orders] insert error:", error.message);
    return NextResponse.json(
      { ok: false, code: "DB_ERROR", message: "Could not create order." },
      { status: 500 }
    );
  }

  const orderIds = ((data as Array<{ id: string }> | null) || []).map((row) => row.id);

  return NextResponse.json(
    {
      ok: true,
      orderIds,
      count: orderIds.length,
    },
    { status: 201 }
  );
}
