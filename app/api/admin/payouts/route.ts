import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { isAdminEmail } = await import("@/lib/server/requestAuth");
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  // Fetch provider payouts
  const { data: providerPayouts } = await db
    .from("provider_payouts")
    .select("*, profiles!inner(full_name, avatar_url)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  // Fetch referral payouts
  const { data: referralPayouts } = await db
    .from("referral_payouts")
    .select("*, profiles!inner(full_name, avatar_url)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    ok: true,
    payouts: providerPayouts ?? [],
    referral_payouts: referralPayouts ?? [],
  });
}

type PatchBody = {
  payoutId: string;
  action: "approve" | "reject" | "complete" | "fail";
  notes?: string;
  kind?: "provider" | "referral";
};

export async function PATCH(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { isAdminEmail } = await import("@/lib/server/requestAuth");
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const statusMap: Record<string, string> = {
    approve: "approved",
    reject: "cancelled",
    complete: "completed",
    fail: "failed",
  };

  const newStatus = statusMap[body.action];
  if (!newStatus) {
    return NextResponse.json({ ok: false, message: "Invalid action" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    notes: body.notes ?? null,
  };

  if (body.action === "approve" || body.action === "complete") {
    updateData.processed_at = new Date().toISOString();
  }

  const table = body.kind === "referral" ? "referral_payouts" : "provider_payouts";

  // For referral payouts, also mark the referrer's pending events as approved
  if (body.kind === "referral" && body.action === "approve") {
    const { data: payout } = await db
      .from("referral_payouts")
      .select("user_id")
      .eq("id", body.payoutId)
      .single<{ user_id: string }>();

    if (payout) {
      await db
        .from("referral_events")
        .update({ status: "approved" })
        .eq("referrer_id", payout.user_id)
        .eq("status", "pending");
    }
  }

  const { error } = await db
    .from(table)
    .update(updateData)
    .eq("id", body.payoutId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
