import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import { sendOrderEmail, shouldSkipOrderEmail } from "@/lib/email";
import { isOrderFulfillmentMethod, type OrderFulfillmentMethod } from "@/lib/orderFulfillment";
import { sendPushToUser } from "@/lib/server/pushNotifications";

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
  fulfillment_method?: OrderFulfillmentMethod;
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

const getQuantity = (item: OrderRequest) =>
  typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
    ? Math.round(item.quantity)
    : 1;

const fulfillmentStatusForNewOrder = (method: OrderFulfillmentMethod | undefined) => {
  if (method === "self") {
    return {
      fulfillment_status: "pickup_pending",
      fulfillment_status_label: "Pickup or meetup pending",
    };
  }

  if (method === "courier") {
    return {
      fulfillment_status: "courier_pending",
      fulfillment_status_label: "Courier handoff pending",
    };
  }

  if (method === "platform") {
    return {
      fulfillment_status: "platform_coordination_pending",
      fulfillment_status_label: "ServiQ coordination pending",
    };
  }

  return {
    fulfillment_status: "provider_review_pending",
    fulfillment_status_label: "Waiting for provider review",
  };
};

const addQuantity = (totals: Map<string, number>, id: string, quantity: number) => {
  totals.set(id, (totals.get(id) || 0) + quantity);
};

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

  const rateLimitCheck = await applyRateLimit(authResult.auth.userId, "orders:create", WRITE_ROUTE_CONFIG);
  if (rateLimitCheck.limited) return rateLimitCheck.response!;

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
  if (requestedItems.some((item) => item.providerId === authResult.auth.userId)) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "You cannot place an order with your own provider profile." },
      { status: 400 }
    );
  }

  for (const item of requestedItems) {
    if (item.price < 0 || item.price > 999999) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid price. Must be between 0 and 999999." }, { status: 400 });
    }
    const qty = getQuantity(item);
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
    if (item.fulfillment_method && !isOrderFulfillmentMethod(item.fulfillment_method)) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid fulfillment method." }, { status: 400 });
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
    const serviceIds = [...new Set(serviceItems.map((i) => i.itemId))];
    const { data: listings } = await admin
      .from("service_listings")
      .select("id,provider_id,availability")
      .in("id", serviceIds);
    if (!listings || listings.length !== serviceIds.length) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "One or more service listings not found." }, { status: 400 });
    }
    const listingById = new Map(
      (listings as Array<{ id: string; provider_id: string | null; availability?: string | null }>).map((listing) => [
        listing.id,
        listing,
      ])
    );
    for (const item of serviceItems) {
      const listing = listingById.get(item.itemId);
      if (!listing || listing.provider_id !== item.providerId) {
        return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Service listing does not belong to this provider." }, { status: 400 });
      }
      if ((listing.availability || "available").toLowerCase() === "offline") {
        return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "This service is currently unavailable." }, { status: 409 });
      }
    }
  }
  const requestedProductQuantities = new Map<string, number>();
  if (productItems.length > 0) {
    for (const item of productItems) {
      addQuantity(requestedProductQuantities, item.itemId, getQuantity(item));
    }
    const productIds = [...requestedProductQuantities.keys()];
    const { data: products } = await admin
      .from("product_catalog")
      .select("id,provider_id,stock")
      .in("id", productIds);
    if (!products || products.length !== productIds.length) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "One or more products not found." }, { status: 400 });
    }
    const productById = new Map(
      (products as Array<{ id: string; provider_id: string | null; stock: number | null }>).map((product) => [
        product.id,
        product,
      ])
    );
    for (const item of productItems) {
      const product = productById.get(item.itemId);
      if (!product || product.provider_id !== item.providerId) {
        return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Product does not belong to this provider." }, { status: 400 });
      }
    }
    for (const [productId, quantity] of requestedProductQuantities) {
      const product = productById.get(productId);
      if (!product || (product.stock || 0) < quantity) {
        return NextResponse.json({ ok: false, code: "OUT_OF_STOCK", message: "One or more products are out of stock." }, { status: 409 });
      }
    }
  }

  const rowsToInsert: Record<string, unknown>[] = requestedItems.map((item) => {
    const quantity = getQuantity(item);
    const fulfillmentStatus = fulfillmentStatusForNewOrder(item.fulfillment_method);
    const metadata: Record<string, unknown> = {
      source: "cart",
      quantity,
      title: clampText(item.title, 160),
      ...fulfillmentStatus,
    };

    const address = clampText(item.address, 500);
    const notes = clampText(item.notes, 1000);
    const paymentStatus = clampText(item.payment_status, 64);
    const razorpayOrderId = clampText(item.razorpay_order_id, 120);
    const razorpayPaymentId = clampText(item.razorpay_payment_id, 120);

    if (address) metadata.address = address;
    if (notes) metadata.notes = notes;
    if (item.payment_method) metadata.payment_method = item.payment_method;
    if (item.fulfillment_method) metadata.fulfillment_method = item.fulfillment_method;
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

  const decrementedProducts: Array<{ productId: string; quantity: number }> = [];
  for (const [productId, quantity] of requestedProductQuantities) {
    const { data: decremented, error: decrementError } = await admin.rpc("decrement_product_stock", {
      target_product_id: productId,
      decrement_by: quantity,
    });

    if (decrementError) {
      console.error("[api/orders] stock decrement error:", decrementError.message);
      return NextResponse.json(
        { ok: false, code: "DB_ERROR", message: "Could not reserve product stock." },
        { status: 500 }
      );
    }

    if (decremented !== true) {
      return NextResponse.json(
        { ok: false, code: "OUT_OF_STOCK", message: "One or more products are out of stock." },
        { status: 409 }
      );
    }

    decrementedProducts.push({ productId, quantity });
  }

  const { data, error } = await admin.from("orders").insert(rowsToInsert).select("id");

  if (error) {
    console.error("[api/orders] insert error:", error.message);
    await Promise.all(
      decrementedProducts.map((item) =>
        admin.rpc("increment_product_stock", {
          target_product_id: item.productId,
          increment_by: item.quantity,
        })
      )
    );
    return NextResponse.json(
      { ok: false, code: "DB_ERROR", message: "Could not create order." },
      { status: 500 }
    );
  }

  const orderIds = ((data as Array<{ id: string }> | null) || []).map((row) => row.id);

  void (async () => {
    try {
      const notificationRows = requestedItems
        .map((item, index) => {
          const orderId = orderIds[index];
          if (!orderId) return null;
          return {
            user_id: item.providerId,
            kind: "order",
            title: "New order received",
            message: `${clampText(item.title, 120) || "A marketplace item"} was ordered. Open the order to confirm fulfillment.`,
            entity_type: "order",
            entity_id: orderId,
            metadata: {
              order_id: orderId,
              item_type: item.itemType,
              title: clampText(item.title, 160),
              source: "checkout",
            },
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

      if (notificationRows.length > 0) {
        await admin.from("notifications").insert(notificationRows);
      }

      await Promise.all(
        requestedItems.map((item, index) => {
          const orderId = orderIds[index];
          if (!orderId) return Promise.resolve({ sent: 0, failed: 0 });
          return sendPushToUser(admin, item.providerId, {
            title: "New order received",
            body: `${clampText(item.title, 120) || "A marketplace item"} was ordered.`,
            data: {
              kind: "order",
              entity_type: "order",
              entity_id: orderId,
              order_id: orderId,
              title: clampText(item.title, 160),
              source: "checkout",
            },
          });
        })
      );
    } catch (err) {
      console.error("[order-provider-notification] failed", err);
    }
  })();

  // Fire-and-forget: email buyer confirmation + provider notification
  void (async () => {
    try {
      const [consumerUser, providerUser] = await Promise.all([
        admin.auth.admin.getUserById(authResult.auth.userId).catch(() => null),
        requestedItems[0] ? admin.auth.admin.getUserById(requestedItems[0].providerId).catch(() => null) : null,
      ]);

      const consumerName = (consumerUser?.data?.user?.user_metadata?.name as string | undefined) ?? "there";
      const consumerEmail = consumerUser?.data?.user?.email;
      const providerName = (providerUser?.data?.user?.user_metadata?.name as string | undefined) ?? undefined;
      const providerEmail = providerUser?.data?.user?.email;

      if (consumerEmail && requestedItems[0]) {
        const consumerSkip = await shouldSkipOrderEmail(authResult.auth.userId);
        if (!consumerSkip) {
          await sendOrderEmail({
            type: "placed",
            to: consumerEmail,
            recipientName: consumerName,
            orderId: orderIds[0] ?? "",
            itemTitle: requestedItems[0].title ?? "your order",
            price: requestedItems[0].price,
          });
        }
      }

      if (providerEmail && requestedItems[0]) {
        const skip = await shouldSkipOrderEmail(requestedItems[0].providerId);
        if (!skip) {
          await sendOrderEmail({
            type: "order_placed_provider",
            to: providerEmail,
            recipientName: providerName ?? "there",
            orderId: orderIds[0] ?? "",
            itemTitle: requestedItems[0].title ?? "an order",
            price: requestedItems[0].price,
            consumerName,
          });
        }
      }
    } catch (err) {
      console.error("[order-emails] failed", err);
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
