import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const url = new URL(request.url);
  const providerId = url.searchParams.get("provider_id") ?? auth.auth.userId;
  const fromDate = url.searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const toDate = url.searchParams.get("to");

  let query = db
    .from("availability_exceptions")
    .select("*")
    .eq("provider_id", providerId)
    .gte("exception_date", fromDate)
    .order("exception_date");

  if (toDate) {
    query = query.lte("exception_date", toDate);
  }

  const { data: exceptions } = await query;
  return NextResponse.json({ ok: true, exceptions: exceptions ?? [] });
}

type ExceptionInput = {
  exception_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_available?: boolean;
  reason?: string | null;
};

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: ExceptionInput | ExceptionInput[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const inputs = Array.isArray(body) ? body : [body];

  for (const item of inputs) {
    if (!item.exception_date) {
      return NextResponse.json({ ok: false, message: "exception_date required" }, { status: 400 });
    }
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const userId = auth.auth.userId;

  const rows = inputs.map((item) => ({
    provider_id: userId,
    exception_date: item.exception_date,
    start_time: item.start_time || null,
    end_time: item.end_time || null,
    is_available: item.is_available ?? false,
    reason: item.reason || null,
  }));

  const { data: exceptions, error } = await db
    .from("availability_exceptions")
    .upsert(rows, { onConflict: "provider_id, exception_date" })
    .select();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, exceptions: exceptions ?? [] });
}

async function deleteHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const exceptionDate = url.searchParams.get("date");

  if (!exceptionDate) {
    return NextResponse.json({ ok: false, message: "date query param required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { error } = await db
    .from("availability_exceptions")
    .delete()
    .eq("provider_id", auth.auth.userId)
    .eq("exception_date", exceptionDate);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = withErrorHandling(getHandler, "availability:exceptions-list");
export const POST = withErrorHandling(postHandler, "availability:exceptions-upsert");
export const DELETE = withErrorHandling(deleteHandler, "availability:exceptions-delete");
