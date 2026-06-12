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

  const userId = auth.auth.userId;

  const { data: bookings, error } = await db
    .from("booking_slots")
    .select("*, orders!inner(title, status, consumer_id, provider_id)")
    .or(`provider_id.eq.${userId},consumer_id.eq.${userId}`)
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // Fetch consumer/provider profiles for display
  const userIds = new Set<string>();
  for (const b of bookings ?? []) {
    const order = (b as Record<string, unknown>).orders as Record<string, unknown> | undefined;
    if (order?.consumer_id) userIds.add(order.consumer_id as string);
    if (order?.provider_id) userIds.add(order.provider_id as string);
  }

  const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  if (userIds.size > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", [...userIds]);
    for (const p of profiles ?? []) {
      profilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
    }
  }

  const enriched = (bookings ?? []).map((b) => {
    const order = (b as Record<string, unknown>).orders as Record<string, unknown> | undefined;
    const consumer = profilesMap.get((order?.consumer_id as string) ?? "");
    const provider = profilesMap.get((order?.provider_id as string) ?? "");
    return {
      ...b,
      order_title: order?.title ?? null,
      order_status: order?.status ?? null,
      consumer_name: consumer?.full_name ?? "Unknown",
      consumer_avatar: consumer?.avatar_url ?? null,
      provider_name: provider?.full_name ?? "Unknown",
      provider_avatar: provider?.avatar_url ?? null,
    };
  });

  return NextResponse.json({ ok: true, bookings: enriched });
}

export const GET = withErrorHandling(getHandler, "provider:bookings");
