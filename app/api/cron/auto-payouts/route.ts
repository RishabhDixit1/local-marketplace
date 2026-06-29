import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";
import { isRazorpayConfigured, getRazorpay } from "@/lib/server/razorpay";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "No DB client." }, { status: 500 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ ok: false, error: "Razorpay not configured. Cannot process payouts." }, { status: 502 });
  }

  const razorpay = getRazorpay();
  const razorpayAccountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER ?? "";

  // Fetch all pending auto-payouts with their bank account fund IDs
  const { data: pending, error: fetchErr } = await db
    .from("provider_payouts")
    .select("id, provider_id, net_amount_paise, provider_bank_accounts!inner(razorpay_fund_account_id)")
    .eq("status", "pending")
    .eq("payout_method", "auto")
    .not("provider_bank_accounts.razorpay_fund_account_id", "is", null);

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 0, errors: 0 });
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const payout of pending) {
    const bankAccount = (payout as Record<string, unknown>).provider_bank_accounts as Record<string, unknown> | undefined;
    const fundAccountId = bankAccount?.razorpay_fund_account_id as string | undefined;

    if (!fundAccountId) {
      skipped++;
      continue;
    }

    try {
      const rzPayout = await razorpay.api.post({
        url: "/payouts",
        data: {
          account_number: razorpayAccountNumber,
          fund_account_id: fundAccountId,
          amount: payout.net_amount_paise,
          currency: "INR",
          mode: "NEFT",
          purpose: "payout",
          reference_id: `auto_payout_${payout.id}`,
          notes: { provider_payout_id: payout.id, source: "auto-cron" },
        },
      }) as { id: string };

      await db
        .from("provider_payouts")
        .update({
          status: "processing",
          razorpay_payout_id: rzPayout.id,
          notes: "Auto-payout submitted to Razorpay",
        })
        .eq("id", payout.id);

      processed++;
    } catch (err) {
      errors++;
      console.error("[auto-payout] Razorpay payout failed for", payout.id, err);

      await db
        .from("provider_payouts")
        .update({
          notes: `Auto-payout failed: ${err instanceof Error ? err.message : "Gateway error"}`,
        })
        .eq("id", payout.id);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    errors,
    total: pending.length,
  });
}
