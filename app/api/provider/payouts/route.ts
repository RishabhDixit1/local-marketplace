import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type PayoutRequest = {
  amount_paise: number;
  payout_method: "bank" | "upi" | "wallet";
  payout_detail?: string;
};

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const userId = auth.auth.userId;

  // Get payouts
  const { data: payouts } = await db
    .from("provider_payouts")
    .select("*")
    .eq("provider_id", userId)
    .order("created_at", { ascending: false });

  // Get total available earnings (sum of provider_payout_paise from completed orders minus already paid out)
  const { data: orders } = await db
    .from("orders")
    .select("provider_payout_paise, metadata")
    .eq("provider_id", userId)
    .in("status", ["completed", "closed"]);

  const totalEarnedPaise = (orders ?? []).reduce(
    (sum, o) => sum + (typeof o.provider_payout_paise === "number" ? o.provider_payout_paise : 0),
    0
  );

  const { data: paidPayouts } = await db
    .from("provider_payouts")
    .select("net_amount_paise")
    .eq("provider_id", userId)
    .in("status", ["completed"]);

  const totalPaidOutPaise = (paidPayouts ?? []).reduce(
    (sum, p) => sum + p.net_amount_paise,
    0
  );

  const { data: pendingPayouts } = await db
    .from("provider_payouts")
    .select("net_amount_paise")
    .eq("provider_id", userId)
    .in("status", ["pending", "approved", "processing"]);

  const totalPendingPaise = (pendingPayouts ?? []).reduce(
    (sum, p) => sum + p.net_amount_paise,
    0
  );

  return NextResponse.json({
    ok: true,
    payouts: payouts ?? [],
    summary: {
      totalEarnedPaise,
      totalPaidOutPaise,
      totalPendingPaise,
      availablePaise: totalEarnedPaise - totalPaidOutPaise - totalPendingPaise,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: PayoutRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.amount_paise || body.amount_paise < 100) {
    return NextResponse.json({ ok: false, message: "Minimum withdrawal is ₹1" }, { status: 400 });
  }

  if (!["bank", "upi", "wallet"].includes(body.payout_method)) {
    return NextResponse.json({ ok: false, message: "Invalid payout method" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const userId = auth.auth.userId;

  // Calculate available balance
  const { data: orders } = await db
    .from("orders")
    .select("provider_payout_paise")
    .eq("provider_id", userId)
    .in("status", ["completed", "closed"]);

  const totalEarnedPaise = (orders ?? []).reduce(
    (sum, o) => sum + (typeof o.provider_payout_paise === "number" ? o.provider_payout_paise : 0),
    0
  );

  const { data: completedPayouts } = await db
    .from("provider_payouts")
    .select("net_amount_paise")
    .eq("provider_id", userId)
    .in("status", ["completed"]);

  const totalPaidOutPaise = (completedPayouts ?? []).reduce((sum, p) => sum + p.net_amount_paise, 0);

  const { data: pendingPayouts } = await db
    .from("provider_payouts")
    .select("net_amount_paise")
    .eq("provider_id", userId)
    .in("status", ["pending", "approved", "processing"]);

  const totalPendingPaise = (pendingPayouts ?? []).reduce((sum, p) => sum + p.net_amount_paise, 0);

  const availablePaise = totalEarnedPaise - totalPaidOutPaise - totalPendingPaise;

  if (body.amount_paise > availablePaise) {
    return NextResponse.json({
      ok: false,
      message: `Insufficient balance. Available: ₹${(availablePaise / 100).toLocaleString("en-IN")}`,
    }, { status: 400 });
  }

  // Fetch payout detail from default bank account if not provided
  let payoutDetail = body.payout_detail;
  if (!payoutDetail) {
    const { data: defaultAccount } = await db
      .from("provider_bank_accounts")
      .select("*")
      .eq("provider_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultAccount) {
      payoutDetail = defaultAccount.account_type === "upi"
        ? defaultAccount.upi_handle
        : `${defaultAccount.account_number} / ${defaultAccount.ifsc_code}`;
    }
  }

  const feePaise = 0; // No fee on withdrawals for now
  const netAmountPaise = body.amount_paise - feePaise;

  const { data: payout, error } = await db
    .from("provider_payouts")
    .insert({
      provider_id: userId,
      amount_paise: body.amount_paise,
      fee_paise: feePaise,
      net_amount_paise: netAmountPaise,
      status: "pending",
      payout_method: body.payout_method,
      payout_detail: payoutDetail ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payout });
}
