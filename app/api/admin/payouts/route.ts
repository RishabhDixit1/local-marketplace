import { NextResponse } from "next/server";
import { requireRequestAuth, isAdminEmail } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { isRazorpayConfigured, getRazorpay } from "@/lib/server/razorpay";

export const runtime = "nodejs";

export const GET = withErrorHandling(async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  const { data: providerPayouts } = await db
    .from("provider_payouts")
    .select("*, profiles!inner(full_name, avatar_url)")
    .eq("status", status)
    .order("created_at", { ascending: false });

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
}, "admin:payouts-list");

type PatchBody = {
  payoutId: string;
  action: "approve" | "reject" | "complete" | "fail";
  notes?: string;
  kind?: "provider" | "referral";
};

export const PATCH = withErrorHandling(async function patchHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

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

  const table = body.kind === "referral" ? "referral_payouts" : "provider_payouts";

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

  if (body.action === "complete" && isRazorpayConfigured() && table === "provider_payouts") {
    try {
      const razorpay = getRazorpay();

      const { data: payout } = await db
        .from("provider_payouts")
        .select("*, provider_bank_accounts!inner(razorpay_fund_account_id)")
        .eq("id", body.payoutId)
        .single();

      if (payout?.provider_bank_accounts?.razorpay_fund_account_id) {
        const rzPayout = await razorpay.api.post({
          url: "/payouts",
          data: {
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER ?? "",
            fund_account_id: payout.provider_bank_accounts.razorpay_fund_account_id,
            amount: payout.net_amount_paise,
            currency: "INR",
            mode: "NEFT",
            purpose: "payout",
            reference_id: `payout_${body.payoutId}`,
            notes: { provider_payout_id: body.payoutId },
          },
        }) as { id: string };

        await db
          .from("provider_payouts")
          .update({
            razorpay_payout_id: rzPayout.id,
            processed_at: new Date().toISOString(),
          })
          .eq("id", body.payoutId);

        await db
          .from(table)
          .update({
            status: newStatus,
            razorpay_payout_id: rzPayout.id,
            notes: body.notes ?? null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", body.payoutId);

        return NextResponse.json({ ok: true, razorpay_payout_id: rzPayout.id });
      }
    } catch (err) {
      console.error("[admin/payouts] Razorpay payout failed:", err);
      return NextResponse.json({
        ok: false,
        message: err instanceof Error ? err.message : "Payout gateway error",
      }, { status: 502 });
    }
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    notes: body.notes ?? null,
  };

  if (["approve", "complete"].includes(body.action)) {
    updateData.processed_at = new Date().toISOString();
  }

  const { error } = await db
    .from(table)
    .update(updateData)
    .eq("id", body.payoutId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}, "admin:payouts-update");
