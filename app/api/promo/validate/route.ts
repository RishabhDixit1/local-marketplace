import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export const POST = withErrorHandling(async function postHandler(request: Request) {
  let body: { code: string; orderPaise?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.code?.trim()) {
    return NextResponse.json({ ok: false, message: "Code is required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { data: result } = await db.rpc("validate_promo_code", {
    p_code: body.code,
    p_order_paise: body.orderPaise ?? 0,
  });

  if (!result) {
    return NextResponse.json({ ok: false, message: "Invalid promo code" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}, "promo:validate");
