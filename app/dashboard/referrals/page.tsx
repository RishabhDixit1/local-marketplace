"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Gift, IndianRupee, Loader2, Lock, Share2, Star, Trophy, Users, Wallet } from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Milestone = {
  key: string;
  label: string;
  referralsRequired: number;
  bonusPoints: number;
  achieved: boolean;
  progress: number;
};

type MilestonesData = {
  ok: boolean;
  referralCount: number;
  milestones: Milestone[];
  nextMilestone: (Milestone & { referralsRemaining: number }) | null;
};

type ReferralCode = {
  id: string; code: string; times_used: number; reward_points: number;
  is_active: boolean; created_at: string;
};
type ReferralEvent = {
  id: string; referred_id: string; reward_points: number;
  status: string; created_at: string;
  profiles: { full_name: string } | null;
};
type Payout = {
  id: string; amount_paise: number; points_redeemed: number;
  status: string; created_at: string;
};

const PAYOUT_STATUS_BADGES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
};

export default function ReferralsPage() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [referrals, setReferrals] = useState<ReferralEvent[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [payoutPoints, setPayoutPoints] = useState(50);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");
  const [milestones, setMilestones] = useState<MilestonesData | null>(null);

  const fetchData = useCallback(async () => {
    const [refData, payoutData, milestoneData] = await Promise.all([
      fetchAuthedJson<{ ok: boolean; codes: ReferralCode[]; referrals: ReferralEvent[]; totalRewards: number }>(
        supabase, "/api/referrals", { method: "GET" }
      ),
      fetchAuthedJson<{ ok: boolean; payouts: Payout[]; totalPoints: number; availablePoints: number }>(
        supabase, "/api/referrals/payout", { method: "GET" }
      ),
      fetchAuthedJson<MilestonesData>(
        supabase, "/api/referrals/milestones", { method: "GET" }
      ).catch(() => null),
    ]);
    if (refData?.ok) {
      setCodes(refData.codes);
      setReferrals(refData.referrals);
      setTotalPoints(refData.totalRewards);
    }
    if (payoutData?.ok) {
      setPayouts(payoutData.payouts);
      setTotalPoints(payoutData.totalPoints);
      setAvailablePoints(payoutData.availablePoints);
    }
    if (milestoneData?.ok) {
      setMilestones(milestoneData);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      await fetchData();
      if (!cancelled) setLoading(false);
    };
    void doLoad();
    return () => { cancelled = true; };
  }, [fetchData]);

  const handleCreate = async () => {
    setCreating(true);
    const data = await fetchAuthedJson<{ ok: boolean; code: ReferralCode }>(
      supabase, "/api/referrals", { method: "POST" }
    );
    if (data?.ok) await fetchData();
    setCreating(false);
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/referral?code=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handlePayout = async () => {
    setRequestingPayout(true);
    setPayoutMsg("");
    const data = await fetchAuthedJson<{ ok: boolean; message?: string }>(
      supabase, "/api/referrals/payout", {
        method: "POST",
        body: JSON.stringify({ points: payoutPoints }),
      }
    );
    setPayoutMsg(data?.message || "Error requesting payout.");
    if (data?.ok) await fetchData();
    setRequestingPayout(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Referrals</h1>
          <p className="text-sm text-slate-500">Invite providers, earn ₹50 per signup.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-center">
          <p className="text-xs text-amber-600">Available</p>
          <p className="text-lg font-bold text-amber-700">
            <IndianRupee className="inline h-4 w-4" />
            {availablePoints}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <Gift className="mx-auto mb-2 h-7 w-7 text-[var(--brand-500)]" />
          <p className="text-xs font-semibold text-slate-500">Codes</p>
          <p className="text-2xl font-bold text-slate-900">{codes.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <Users className="mx-auto mb-2 h-7 w-7 text-[var(--brand-500)]" />
          <p className="text-xs font-semibold text-slate-500">Referred</p>
          <p className="text-2xl font-bold text-slate-900">{referrals.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <Wallet className="mx-auto mb-2 h-7 w-7 text-[var(--brand-500)]" />
          <p className="text-xs font-semibold text-slate-500">Earned (₹)</p>
          <p className="text-2xl font-bold text-slate-900">{totalPoints}</p>
        </div>
      </div>

      {milestones && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Milestones</h2>
            <Link
              href="/dashboard/referrals/leaderboard"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Trophy className="h-3 w-3" />
              Leaderboard
            </Link>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            {milestones.referralCount} approved referral{milestones.referralCount === 1 ? "" : "s"}
            {milestones.nextMilestone ? ` · ${milestones.nextMilestone.referralsRemaining} more for "${milestones.nextMilestone.label}"` : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {milestones.milestones.map((m) => (
              <div
                key={m.key}
                className={`rounded-xl border p-3.5 transition ${
                  m.achieved
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {m.achieved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-300" />
                    )}
                    <span className={`text-sm font-bold ${m.achieved ? "text-emerald-800" : "text-slate-500"}`}>
                      {m.label}
                    </span>
                  </div>
                  {m.achieved && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>{m.referralsRequired} referral{m.referralsRequired === 1 ? "" : "s"}</span>
                  <span className="font-medium text-[var(--brand-700)]">+{m.bonusPoints} pts</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      m.achieved ? "bg-emerald-500" : "bg-[var(--brand-400)]"
                    }`}
                    style={{ width: `${Math.min(100, m.progress * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Request Payout</h2>
        <p className="text-xs text-slate-500 mb-4">
          1 point = ₹1. Minimum 50 points (₹50) to withdraw.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={50}
            max={availablePoints}
            value={payoutPoints}
            onChange={(e) => setPayoutPoints(Math.max(50, parseInt(e.target.value) || 0))}
            className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-400)]"
          />
          <span className="text-xs text-slate-500">points = ₹{payoutPoints}</span>
          <button
            type="button"
            onClick={handlePayout}
            disabled={requestingPayout || payoutPoints < 50 || payoutPoints > availablePoints}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            {requestingPayout ? <Loader2 className="h-3 w-3 animate-spin" /> : <IndianRupee className="h-3.5 w-3.5" />}
            Request Payout
          </button>
        </div>
        {payoutMsg && (
          <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{payoutMsg}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Referral Codes</h2>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Generate Code
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : codes.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">No codes yet. Generate your first referral code.</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div>
                  <code className="text-sm font-bold text-[var(--brand-700)]">{c.code}</code>
                  <p className="text-[10px] text-slate-400">{c.times_used} used · ₹{c.reward_points} each</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(c.code)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Share2 className="h-3 w-3" />
                  {copied === c.code ? "Copied!" : "Share"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {referrals.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Referral History</h2>
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.profiles?.full_name || "Someone"} joined</p>
                  <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  +₹{r.reward_points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {payouts.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Payout History</h2>
          <div className="space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">₹{(p.amount_paise / 100).toFixed(0)}</p>
                  <p className="text-xs text-slate-400">{p.points_redeemed} pts · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAYOUT_STATUS_BADGES[p.status] || "bg-slate-100 text-slate-600"}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
