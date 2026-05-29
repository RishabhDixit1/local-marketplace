import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const url = new URL(request.url);
  const targetProviderId = url.searchParams.get("provider_id") ?? auth.auth.userId;

  const { data: slots } = await db
    .from("provider_availability_slots")
    .select("*")
    .eq("provider_id", targetProviderId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  return NextResponse.json({ ok: true, slots: slots ?? [] });
}

type SlotInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: SlotInput[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ ok: false, message: "Expected array of slots" }, { status: 400 });
  }

  for (const slot of body) {
    if (typeof slot.day_of_week !== "number" || slot.day_of_week < 0 || slot.day_of_week > 6) {
      return NextResponse.json({ ok: false, message: "day_of_week must be 0-6" }, { status: 400 });
    }
    if (!slot.start_time || !slot.end_time) {
      return NextResponse.json({ ok: false, message: "start_time and end_time required" }, { status: 400 });
    }
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const userId = auth.auth.userId;

  // Replace all slots for this provider
  await db.from("provider_availability_slots").delete().eq("provider_id", userId);

  const inserts = body.map((slot) => ({
    provider_id: userId,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time,
    end_time: slot.end_time,
    is_active: true,
  }));

  const { data: slots, error } = await db
    .from("provider_availability_slots")
    .insert(inserts)
    .select();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slots: slots ?? [] });
}
