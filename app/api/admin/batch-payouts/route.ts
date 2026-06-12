import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request) {
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

  const { data: pendingPayouts } = await db
    .from("provider_payouts")
    .select("*")
    .eq("status", "pending");

  if (!pendingPayouts || pendingPayouts.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, failed: 0, errors: [] });
  }

  const now = Date.now();
  const processed: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];

  for (const payout of pendingPayouts) {
    const providerId = payout.provider_id;

    // Recalculate provider's available balance
    const { data: orders } = await db
      .from("orders")
      .select("provider_payout_paise, metadata")
      .eq("provider_id", providerId)
      .in("status", ["completed", "closed"]);

    const totalEarnedPaise = (orders ?? []).reduce((sum, o) => {
      const meta =
        typeof o.metadata === "object" && o.metadata !== null
          ? (o.metadata as Record<string, unknown>)
          : {};
      const fundsStatus = String(meta.funds_status ?? "");
      if (fundsStatus === "held") {
        const heldUntil = meta.funds_held_until
          ? new Date(String(meta.funds_held_until)).getTime()
          : Infinity;
        if (heldUntil > now) return sum;
      }
      return sum + (typeof o.provider_payout_paise === "number" ? o.provider_payout_paise : 0);
    }, 0);

    const { data: paidPayouts } = await db
      .from("provider_payouts")
      .select("net_amount_paise")
      .eq("provider_id", providerId)
      .in("status", ["completed"]);

    const totalPaidOutPaise = (paidPayouts ?? []).reduce(
      (sum, p) => sum + p.net_amount_paise,
      0
    );

    const { data: pendingPayoutsForProvider } = await db
      .from("provider_payouts")
      .select("net_amount_paise")
      .eq("provider_id", providerId)
      .in("status", ["pending", "approved", "processing"]);

    const totalPendingPaise = (pendingPayoutsForProvider ?? []).reduce(
      (sum, p) => sum + p.net_amount_paise,
      0
    );

    const availablePaise = totalEarnedPaise - totalPaidOutPaise - totalPendingPaise;

    if (payout.net_amount_paise > availablePaise) {
      const { error: failError } = await db
        .from("provider_payouts")
        .update({
          status: "failed",
          notes: `Insufficient balance. Available: ₹${(availablePaise / 100).toLocaleString("en-IN")}`,
        })
        .eq("id", payout.id);

      if (failError) {
        errors.push(`Failed to mark payout ${payout.id} as failed: ${failError.message}`);
      } else {
        failed.push(payout.id);
      }
      continue;
    }

    // Mark as processing then completed
    const { error: processingError } = await db
      .from("provider_payouts")
      .update({ status: "processing" })
      .eq("id", payout.id);

    if (processingError) {
      errors.push(`Failed to mark payout ${payout.id} as processing: ${processingError.message}`);
      continue;
    }

    const { error: completeError } = await db
      .from("provider_payouts")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    if (completeError) {
      errors.push(`Failed to complete payout ${payout.id}: ${completeError.message}`);
      continue;
    }

    processed.push(payout.id);

    // Create notification for the provider
    await db.from("notifications").insert({
      user_id: providerId,
      kind: "system",
      title: "Payout completed",
      message: `Your payout of ₹${(payout.net_amount_paise / 100).toLocaleString("en-IN")} has been processed automatically.`,
      entity_type: "payout",
      entity_id: payout.id,
    });
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    failed: failed.length,
    errors,
  });
}

export const POST = withErrorHandling(postHandler, "admin:batch-payouts");
