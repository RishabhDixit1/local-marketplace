import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

const MILESTONES = [
  { key: "newcomer", label: "Newcomer", referralsRequired: 1, bonusPoints: 50 },
  { key: "helper", label: "Helper", referralsRequired: 5, bonusPoints: 300 },
  { key: "community_builder", label: "Community Builder", referralsRequired: 10, bonusPoints: 750 },
  { key: "super_connector", label: "Super Connector", referralsRequired: 25, bonusPoints: 2000 },
  { key: "local_champion", label: "Local Champion", referralsRequired: 50, bonusPoints: 5000 },
];

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const { count } = await db
    .from("referral_events")
    .select("*", { head: true, count: "exact" })
    .eq("referrer_id", auth.auth.userId)
    .eq("status", "approved");

  const referralCount = count ?? 0;

  const achieved = MILESTONES.filter((m) => referralCount >= m.referralsRequired);
  let nextMilestone = null;
  for (const m of MILESTONES) {
    if (referralCount < m.referralsRequired) {
      nextMilestone = { ...m, referralsRemaining: m.referralsRequired - referralCount };
      break;
    }
  }

  return NextResponse.json({
    ok: true,
    referralCount,
    milestones: MILESTONES.map((m) => ({
      ...m,
      achieved: referralCount >= m.referralsRequired,
      progress: Math.min(1, referralCount / m.referralsRequired),
    })),
    achieved,
    nextMilestone,
  });
}

export const GET = withErrorHandling(getHandler, "referrals:milestones");
