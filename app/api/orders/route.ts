import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { sendOrderEmail } from "@/lib/email";

export const runtime = "nodejs";

type OrderRequest = {
  providerId: string;
  itemType: "service" | "product";
  itemId: string;
  price: number;
  quantity?: number;
  title?: string;
  address?: string;
  notes?: string;
  payment_method?: "cod" | "razorpay";
  payment_status?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
};

type BulkOrderRequest = {
  items: OrderRequest[];
};

const trimText = (value: unknown) => {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized) return "";
  return normalized;
};

const clampText = (value: unknown, maxLength: number) => trimText(value).slice(0, maxLength);

const isValidPaymentMethod = (value: unknown): value is NonNullable<OrderRequest["payment_method"]> =>
  value === "cod" || value === "razorpay";

function isOrderRequest(body: unknown): body is OrderRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.providerId === "string" && b.providerId.length > 0 &&
    (b.itemType === "service" || b.itemType === "product") &&
    typeof b.itemId === "string" && b.itemId.length > 0 &&
    typeof b.price === "number" &&
    b.price >= 0 && b.price <= 999999
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

  // -- Input validation --
  for (const item of requestedItems) {
    if (item.price < 0 || item.price > 999999) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid price. Must be between 0 and 999999." }, { status: 400 });
    }
    const qty = typeof item.quantity === "number" ? item.quantity : 1;
    if (qty < 1 || qty > 100) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid quantity. Must be between 1 and 100." }, { status: 400 });
    }
    const address = trimText(item.address);
    if (address.length > 500) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Address must be 500 characters or fewer." }, { status: 400 });
    }
    const notes = trimText(item.notes);
    if (notes.length > 1000) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Notes must be 1000 characters or fewer." }, { status: 400 });
    }
    if (item.payment_method && !isValidPaymentMethod(item.payment_method)) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid payment method." }, { status: 400 });
    }
    const paymentStatus = trimText(item.payment_status);
    if (paymentStatus.length > 64) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Payment status is too long." }, { status: 400 });
    }
    const razorpayOrderId = trimText(item.razorpay_order_id);
    const razorpayPaymentId = trimText(item.razorpay_payment_id);
    if (razorpayOrderId.length > 120 || razorpayPaymentId.length > 120) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Payment identifiers are too long." }, { status: 400 });
    }
  }

  // -- Verify providerId exists --
  const uniqueProviderIds = [...new Set(requestedItems.map((i) => i.providerId))];
  const { data: providers, error: providerErr } = await admin
    .from("profiles")
    .select("id")
    .in("id", uniqueProviderIds);
  if (providerErr || !providers || providers.length !== uniqueProviderIds.length) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "One or more providers not found." }, { status: 400 });
  }

  // -- Verify itemIds exist in the correct table --
  const serviceItems = requestedItems.filter((i) => i.itemType === "service");
  const productItems = requestedItems.filter((i) => i.itemType === "product");
  if (serviceItems.length > 0) {
    const { data: listings } = await admin
      .from("service_listings")
      .select("id")
      .in("id", serviceItems.map((i) => i.itemId));
    if (!listings || listings.length !== serviceItems.length) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "One or more service listings not found." }, { status: 400 });
    }
  }
  if (productItems.length > 0) {
    const { data: products } = await admin
      .from("product_catalog")
      .select("id")
      .in("id", productItems.map((i) => i.itemId));
    if (!products || products.length !== productItems.length) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "One or more products not found." }, { status: 400 });
    }
  }

  const rowsToInsert: Record<string, unknown>[] = requestedItems.map((item) => {
    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    const metadata: Record<string, unknown> = {
      source: "cart",
      quantity,
      title: clampText(item.title, 160),
    };

    const address = clampText(item.address, 500);
    const notes = clampText(item.notes, 1000);
    const paymentStatus = clampText(item.payment_status, 64);
    const razorpayOrderId = clampText(item.razorpay_order_id, 120);
    const razorpayPaymentId = clampText(item.razorpay_payment_id, 120);

    if (address) metadata.address = address;
    if (notes) metadata.notes = notes;
    if (item.payment_method) metadata.payment_method = item.payment_method;
    if (paymentStatus) metadata.payment_status = paymentStatus;
    if (razorpayOrderId) metadata.razorpay_order_id = razorpayOrderId;
    if (razorpayPaymentId) metadata.razorpay_payment_id = razorpayPaymentId;

    const insert: Record<string, unknown> = {
      consumer_id: authResult.auth.userId,
      provider_id: item.providerId,
      listing_type: item.itemType,
      price: item.price,
      status: "new_lead",
      metadata,
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

  // Fire-and-forget: email buyer confirmation (with error capture)
  void (async () => {
    try {
      const { data: userData } = await admin.auth.admin.getUserById(authResult.auth.userId);
      const email = userData?.user?.email;
      if (email && requestedItems[0]) {
        await sendOrderEmail({
          type: "placed",
          to: email,
          recipientName: (userData.user?.user_metadata?.name as string | undefined) ?? "there",
          orderId: orderIds[0] ?? "",
          itemTitle: requestedItems[0].title ?? "your order",
          price: requestedItems[0].price,
        });
      }
    } catch (err) {
      console.error("[order-email] failed for order", orderIds[0], err);
    }
  })();

  return NextResponse.json(
    {
      ok: true,
      orderIds,
      count: orderIds.length,
    },
    { status: 201 }
  );
}
