import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireAdminAuth } from "@/lib/server/requestAuth";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

type ListingType = "posts" | "service_listings" | "product_catalog";

const VALID_TABLES: ListingType[] = ["posts", "service_listings", "product_catalog"];

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const url = new URL(request.url);
  const table = (url.searchParams.get("table") || "posts") as ListingType;
  const filter = url.searchParams.get("filter") || "all"; // all | flagged | removed
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  if (!VALID_TABLES.includes(table)) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid table parameter." }, { status: 400 });
  }

  // Use service_role client (bypasses RLS) to fetch all listings including flagged/removed
  let query = db.from(table).select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (filter === "flagged") {
    query = query.eq("is_flagged", true);
  } else if (filter === "removed") {
    query = query.not("removed_at", "is", null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, listings: data ?? [], count: data?.length ?? 0 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const rateLimit = await applyRateLimit(auth.auth.userId, "admin:listings", WRITE_ROUTE_CONFIG);
  if (rateLimit.limited) return rateLimit.response;

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  let body: { id: string; table: ListingType; action: "flag" | "unflag" | "remove" | "restore"; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || !body.table || !body.action) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "id, table, and action are required." }, { status: 400 });
  }

  if (!VALID_TABLES.includes(body.table)) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid table." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.action === "flag") {
    const update: Record<string, unknown> = {
      is_flagged: true,
      flagged_at: now,
      flagged_reason: body.reason || null,
    };
    // For posts, also transition status to 'hidden' via metadata
    const { error } = await db.from(body.table).update(update).eq("id", body.id);
    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "flagged" });
  }

  if (body.action === "unflag") {
    const { error } = await db.from(body.table).update({
      is_flagged: false,
      flagged_at: null,
      flagged_reason: null,
    }).eq("id", body.id);
    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "unflagged" });
  }

  if (body.action === "remove") {
    const update: Record<string, unknown> = {
      removed_at: now,
      is_flagged: true,
      flagged_at: now,
      flagged_reason: body.reason || "Removed by admin",
    };
    const { error } = await db.from(body.table).update(update).eq("id", body.id);
    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "removed" });
  }

  if (body.action === "restore") {
    const { error } = await db.from(body.table).update({
      removed_at: null,
      is_flagged: false,
      flagged_at: null,
      flagged_reason: null,
    }).eq("id", body.id);
    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "restored" });
  }

  return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Unsupported action." }, { status: 400 });
}
