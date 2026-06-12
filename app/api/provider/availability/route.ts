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
  timezone?: string;
};

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: { slots: SlotInput[]; timezone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const slotsInput = Array.isArray(body) ? body : body.slots;
  const timezone = body.timezone || "Asia/Kolkata";

  if (!Array.isArray(slotsInput) || slotsInput.length === 0) {
    return NextResponse.json({ ok: false, message: "Expected array of slots" }, { status: 400 });
  }

  for (const slot of slotsInput) {
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

  const inserts = slotsInput.map((slot) => ({
    provider_id: userId,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time,
    end_time: slot.end_time,
    timezone,
    is_active: true,
  }));

  const { data: slots, error } = await db
    .from("provider_availability_slots")
    .insert(inserts)
    .select();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slots: slots ?? [], timezone });
}

export const GET = withErrorHandling(getHandler, "provider:availability");
export const POST = withErrorHandling(postHandler, "provider:availability-upsert");
