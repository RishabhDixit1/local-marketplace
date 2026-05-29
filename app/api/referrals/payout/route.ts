import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const POINTS_PER_RUPEE = 1;

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const points = typeof body.points === "number" ? body.points : 0;

  if (points < 50) {
    return NextResponse.json({ ok: false, message: "Minimum 50 points required." }, { status: 400 });
  }

  const { data: events } = await db
    .from("referral_events")
    .select("reward_points, status")
    .eq("referrer_id", auth.auth.userId);

  const totalPoints = (events || []).reduce((sum, e) => sum + (e.reward_points || 0), 0);

  const { data: payouts } = await db
    .from("referral_payouts")
    .select("points_redeemed, status")
    .eq("user_id", auth.auth.userId)
    .not("status", "in", '("failed")');

  const redeemedPoints = (payouts || []).reduce((sum, p) => sum + p.points_redeemed, 0);
  const availablePoints = totalPoints - redeemedPoints;

  if (points > availablePoints) {
    return NextResponse.json({ ok: false, message: `You only have ${availablePoints} points available.` }, { status: 400 });
  }

  const amountPaise = Math.round((points / POINTS_PER_RUPEE) * 100);

  const { error } = await db.from("referral_payouts").insert({
    user_id: auth.auth.userId,
    amount_paise: amountPaise,
    points_redeemed: points,
    status: "pending",
  });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    message: `₹${(amountPaise / 100).toFixed(0)} payout requested for ${points} points.`,
  });
}

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const { data, error } = await db
    .from("referral_payouts")
    .select("*")
    .eq("user_id", auth.auth.userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const { data: events } = await db
    .from("referral_events")
    .select("reward_points, status")
    .eq("referrer_id", auth.auth.userId);

  const totalPoints = (events || []).reduce((sum, e) => sum + (e.reward_points || 0), 0);
  const redeemedPoints = (data || []).reduce((sum, p) => sum + (p.points_redeemed || 0), 0);

  return NextResponse.json({
    ok: true,
    payouts: data || [],
    totalPoints,
    redeemedPoints,
    availablePoints: totalPoints - redeemedPoints,
  });
}
