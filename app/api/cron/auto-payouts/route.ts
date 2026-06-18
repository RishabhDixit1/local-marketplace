import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

/**
 * Cron endpoint called periodically (e.g. every hour via cron job) to
 * auto-process pending payouts with method = "auto".
 *
 * This transitions auto-payouts from "pending" → "processing" → "completed"
 * for providers who have at least one bank/UPI account on file.
 */
export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "No DB client." }, { status: 500 });
  }

  // Fetch all pending auto-payouts
  const { data: pending, error: fetchErr } = await db
    .from("provider_payouts")
    .select("id, provider_id, net_amount_paise")
    .eq("status", "pending")
    .eq("payout_method", "auto");

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 0, errors: 0 });
  }

  // Group by provider to check if they have a bank/UPI account
  const providerIds = [...new Set(pending.map((p) => p.provider_id))];

  const { data: accounts } = await db
    .from("provider_bank_accounts")
    .select("provider_id")
    .in("provider_id", providerIds);

  const providersWithAccounts = new Set((accounts ?? []).map((a: Record<string, unknown>) => a.provider_id as string));

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const payout of pending) {
    if (!providersWithAccounts.has(payout.provider_id)) {
      // Skip: provider has no bank/UPI account on file
      skipped++;
      continue;
    }

    // Mark as processing, then completed
    const { error: procErr } = await db
      .from("provider_payouts")
      .update({ status: "processing", notes: "Auto-processing via cron" })
      .eq("id", payout.id);

    if (procErr) {
      errors++;
      console.error("[auto-payout] failed to start processing", payout.id, procErr.message);
      continue;
    }

    const { error: doneErr } = await db
      .from("provider_payouts")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        notes: "Auto-payout completed via cron",
      })
      .eq("id", payout.id);

    if (doneErr) {
      // Revert to pending
      await db.from("provider_payouts")
        .update({ status: "pending", notes: "Reverted after processing failure" })
        .eq("id", payout.id);
      errors++;
      console.error("[auto-payout] failed to complete", payout.id, doneErr.message);
      continue;
    }

    processed++;
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    errors,
    total: pending.length,
  });
}
