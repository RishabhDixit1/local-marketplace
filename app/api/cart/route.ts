import { NextRequest, NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

// ── Types ───────────────────────────────────────────────────────────

type CartItemInput = {
  itemType: "service" | "product";
  itemId: string;
  providerId: string;
  providerName: string;
  title: string;
  price: number;
  quantity: number;
  deliveryMethod?: string | null;
};

type CartItem = CartItemInput & {
  id: string;
  cartId: string;
  createdAt: string;
};

const FK_VIOLATION = /violates foreign key constraint/i;

// ── Helpers ─────────────────────────────────────────────────────────

async function ensureCart(
  db: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  email?: string,
): Promise<string> {
  if (!db) throw new Error("No DB client.");

  const { data: existing } = await db
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await db
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .maybeSingle();

  if (created) return created.id;

  // FK violation — try to create the user in auth.users and retry
  if (error && FK_VIOLATION.test(error.message) && email) {
    try {
      const { error: createError } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (!createError || /already.+(registered|exists)/i.test(createError.message)) {
        const { data: retry } = await db
          .from("carts")
          .insert({ user_id: userId })
          .select("id")
          .maybeSingle();
        if (retry) return retry.id;
      }
    } catch {
      // fall through to error
    }
  }

  // Insert failed (race / unique constraint / RLS) — retry fetch
  if (error) {
    const { data: retry } = await db
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (retry) return retry.id;
  }

  throw new Error(`Failed to create cart: ${error?.message || "unknown error"}`);
}

function toResponse(item: Record<string, unknown>): CartItem {
  return {
    id: item.id as string,
    cartId: item.cart_id as string,
    itemType: item.item_type as "service" | "product",
    itemId: item.item_id as string,
    providerId: item.provider_id as string,
    providerName: item.provider_name as string,
    title: item.title as string,
    price: item.price_paise as number,
    quantity: item.quantity as number,
    deliveryMethod: item.delivery_method as string | null ?? null,
    createdAt: item.created_at as string,
  };
}

// ── GET — fetch server cart ─────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: "No DB client." }, { status: 500 });
  }

  const cartId = await ensureCart(db, auth.auth.userId, auth.auth.email);

  const { data: items, error } = await db
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: items.map(toResponse) });
}

// ── PUT — replace entire cart (sync) ────────────────────────────────

export async function PUT(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: "No DB client." }, { status: 500 });
  }

  const body: { items?: CartItemInput[] } = await request.json();
  const incoming = body.items ?? [];
  const cartId = await ensureCart(db, auth.auth.userId, auth.auth.email);

  const { error: delErr } = await db
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (incoming.length === 0) {
    await db
      .from("carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cartId);

    return NextResponse.json({ items: [] });
  }

  const rows = incoming.map((i) => ({
    cart_id: cartId,
    item_type: i.itemType,
    item_id: i.itemId,
    provider_id: i.providerId,
    provider_name: i.providerName,
    title: i.title,
    price_paise: Math.round(i.price),
    quantity: i.quantity,
    delivery_method: i.deliveryMethod ?? null,
  }));

  const { data: inserted, error: insErr } = await db
    .from("cart_items")
    .insert(rows)
    .select("*");

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await db
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);

  return NextResponse.json({ items: (inserted ?? []).map(toResponse) });
}

// ── DELETE — clear server cart ──────────────────────────────────────

export async function DELETE(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: "No DB client." }, { status: 500 });
  }

  const cartId = await ensureCart(db, auth.auth.userId, auth.auth.email);

  await db.from("cart_items").delete().eq("cart_id", cartId);
  await db
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);

  return NextResponse.json({ success: true });
}
