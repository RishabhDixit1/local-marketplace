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

  if (!isOrderRequest(body)) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "Missing or invalid fields: providerId, itemType, itemId, price." },
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

  const quantity = typeof body.quantity === "number" && body.quantity > 0 ? body.quantity : 1;

  const insert: Record<string, unknown> = {
    consumer_id: authResult.auth.userId,
    provider_id: body.providerId,
    listing_type: body.itemType,
    price: body.price,
    status: "new_lead",
    metadata: {
      source: "cart",
      quantity,
      title: body.title || "",
    },
  };

  if (body.itemType === "service") {
    insert.service_id = body.itemId;
    insert.listing_id = body.itemId;
  } else {
    insert.product_id = body.itemId;
    insert.listing_id = body.itemId;
  }

  const { data, error } = await admin
    .from("orders")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    console.error("[api/orders] insert error:", error.message);
    return NextResponse.json(
      { ok: false, code: "DB_ERROR", message: "Could not create order." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, orderId: (data as { id: string }).id }, { status: 201 });
}
