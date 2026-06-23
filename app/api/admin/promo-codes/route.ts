import { NextResponse } from "next/server";
import { requireRequestAuth, isAdminEmail } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok || !isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";

  let query = db.from("promo_codes").select("*").order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, codes: data ?? [] });
}, "admin:promo-codes-list");

export const POST = withErrorHandling(async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok || !isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  let body: {
    code: string;
    description?: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    max_uses?: number;
    min_order_paise?: number;
    max_discount_paise?: number;
    valid_from?: string;
    valid_until?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.code || !body.discount_type || !body.discount_value) {
    return NextResponse.json({ ok: false, message: "code, discount_type, discount_value required" }, { status: 400 });
  }

  if (!["percent", "fixed"].includes(body.discount_type)) {
    return NextResponse.json({ ok: false, message: "discount_type must be 'percent' or 'fixed'" }, { status: 400 });
  }

  const { data, error } = await db.from("promo_codes").insert({
    code: body.code.toUpperCase().trim(),
    description: body.description?.trim() ?? null,
    discount_type: body.discount_type,
    discount_value: body.discount_value,
    max_uses: body.max_uses ?? 0,
    min_order_paise: body.min_order_paise ?? 0,
    max_discount_paise: body.max_discount_paise ?? null,
    valid_from: body.valid_from ? new Date(body.valid_from).toISOString() : null,
    valid_until: body.valid_until ? new Date(body.valid_until).toISOString() : null,
    created_by: auth.auth.userId,
  }).select().single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code: data });
}, "admin:promo-codes-create");

export const PATCH = withErrorHandling(async function patchHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok || !isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  let body: { id: string; is_active?: boolean; max_uses?: number; valid_until?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.max_uses !== undefined) updates.max_uses = body.max_uses;
  if (body.valid_until !== undefined) updates.valid_until = new Date(body.valid_until).toISOString();

  const { error } = await db.from("promo_codes").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, "admin:promo-codes-update");
