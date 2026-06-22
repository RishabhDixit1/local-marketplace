import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const { data: referrals, error } = await db
    .from("referral_events")
    .select("referrer_id, reward_points, status, profiles!referral_events_referrer_id_fkey(id, name, full_name, avatar_url)")
    .eq("status", "approved");

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  type ReferralRow = { referrer_id: string; reward_points: number; profiles: Array<{ name: string; full_name: string; avatar_url: string }> | null };
  const counts = new Map<string, { count: number; totalPoints: number; profile: { full_name: string; name: string; avatar_url: string } | null }>();
  for (const r of (referrals || []) as ReferralRow[]) {
    const profile = r.profiles?.[0] || null;
    const existing = counts.get(r.referrer_id);
    if (existing) {
      existing.count += 1;
      existing.totalPoints += r.reward_points;
    } else {
      counts.set(r.referrer_id, {
        count: 1,
        totalPoints: r.reward_points,
        profile: profile ? { full_name: profile.full_name, name: profile.name, avatar_url: profile.avatar_url } : null,
      });
    }
  }

  const sorted = Array.from(counts.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.count - a.count || b.totalPoints - a.totalPoints);

  const top20 = sorted.slice(0, 20).map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    fullName: entry.profile?.full_name || entry.profile?.name || "Anonymous",
    avatarUrl: entry.profile?.avatar_url || null,
    referralCount: entry.count,
    totalPoints: entry.totalPoints,
  }));

  let currentUserRank = null;
  const currentUserIndex = sorted.findIndex((e) => e.userId === auth.auth.userId);
  if (currentUserIndex !== -1) {
    const entry = sorted[currentUserIndex];
    currentUserRank = {
      rank: currentUserIndex + 1,
      userId: entry.userId,
      fullName: entry.profile?.full_name || entry.profile?.name || "You",
      avatarUrl: entry.profile?.avatar_url || null,
      referralCount: entry.count,
      totalPoints: entry.totalPoints,
    };
  }

  return NextResponse.json({
    ok: true,
    top20,
    totalReferrers: sorted.length,
    currentUserRank,
  });
}

export const GET = withErrorHandling(getHandler, "referrals:leaderboard");
