"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Share2, Users } from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

type ReferralCode = {
  id: string;
  code: string;
  times_used: number;
  reward_points: number;
  is_active: boolean;
  created_at: string;
};
type ReferralEvent = {
  id: string;
  referred_id: string;
  reward_points: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
};

export default function ReferralsPage() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [referrals, setReferrals] = useState<ReferralEvent[]>([]);
  const [totalRewards, setTotalRewards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchAuthedJson<{ ok: boolean; codes: ReferralCode[]; referrals: ReferralEvent[]; totalRewards: number }>(
        supabase, "/api/referrals", { method: "GET" }
      );
      if (cancelled) return;
      if (data?.ok) {
        setCodes(data.codes);
        setReferrals(data.referrals);
        setTotalRewards(data.totalRewards);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAuthedJson<{ ok: boolean; codes: ReferralCode[]; referrals: ReferralEvent[]; totalRewards: number }>(
      supabase, "/api/referrals", { method: "GET" }
    );
    if (data?.ok) {
      setCodes(data.codes);
      setReferrals(data.referrals);
      setTotalRewards(data.totalRewards);
    }
    setLoading(false);
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const data = await fetchAuthedJson<{ ok: boolean; code: ReferralCode }>(
      supabase, "/api/referrals", { method: "POST" }
    );
    if (data?.ok) await load();
    setCreating(false);
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/referral?code=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Referrals</h1>
          <p className="text-sm text-slate-500">Invite others and earn rewards.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-center">
          <p className="text-xs text-amber-600">Total Rewards</p>
          <p className="text-lg font-bold text-amber-700">{totalRewards} pts</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <Gift className="mx-auto mb-2 h-8 w-8 text-[var(--brand-500)]" />
          <p className="text-sm font-semibold text-slate-900">Referral Codes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{codes.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-[var(--brand-500)]" />
          <p className="text-sm font-semibold text-slate-900">People Referred</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{referrals.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Your Referral Codes</h2>
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
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div>
                  <code className="text-sm font-bold text-[var(--brand-700)]">{c.code}</code>
                  <p className="text-[10px] text-slate-400">Used {c.times_used} times · {c.reward_points} pts each</p>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Referral History</h2>
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.profiles?.full_name || "Someone"} joined</p>
                  <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  +{r.reward_points} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
