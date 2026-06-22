"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Loader2, Medal, Star, Trophy, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import Link from "next/link";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  referralCount: number;
  totalPoints: number;
};

type LeaderboardData = {
  ok: boolean;
  top20: LeaderboardEntry[];
  totalReferrers: number;
  currentUserRank: LeaderboardEntry | null;
};

const RANK_ICONS: Record<number, { icon: typeof Crown; className: string }> = {
  1: { icon: Trophy, className: "text-yellow-500" },
  2: { icon: Medal, className: "text-slate-400" },
  3: { icon: Medal, className: "text-amber-600" },
};

export default function ReferralLeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchAuthedJson<LeaderboardData>(
          supabase, "/api/referrals/leaderboard", { method: "GET" }
        );
        if (!cancelled && result?.ok) setData(result);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/referrals"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Referral Leaderboard</h1>
          <p className="text-sm text-slate-500">Top referrers in the community</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Could not load leaderboard.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3 text-right">Referrals</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.top20.map((entry) => {
                    const RankIcon = RANK_ICONS[entry.rank];
                    return (
                      <tr
                        key={entry.userId}
                        className={`transition hover:bg-slate-50 ${
                          entry.userId === data.currentUserRank?.userId
                            ? "bg-[var(--brand-50)]"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          {RankIcon ? (
                            <RankIcon.icon className={`mx-auto h-4 w-4 ${RankIcon.className}`} />
                          ) : (
                            <span className="text-slate-400 font-medium">{entry.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-xs font-bold text-[var(--brand-700)]">
                              {entry.avatarUrl ? (
                                <img src={entry.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                              ) : (
                                entry.fullName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                              {entry.fullName}
                              {entry.userId === data.currentUserRank?.userId && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-700)]">
                                  <User className="h-2.5 w-2.5" /> You
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {entry.referralCount}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">
                          {entry.totalPoints}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {data.currentUserRank && data.currentUserRank.rank > 20 && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Your Rank</h2>
              </div>
              <div className="border-t border-slate-100">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-[var(--brand-50)]">
                      <td className="px-4 py-3 text-center w-12">
                        <span className="text-slate-400 font-medium">{data.currentUserRank.rank}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-xs font-bold text-[var(--brand-700)]">
                            {data.currentUserRank.avatarUrl ? (
                              <img src={data.currentUserRank.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              data.currentUserRank.fullName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-semibold text-slate-900">
                            {data.currentUserRank.fullName}
                            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-700)]">
                              <User className="h-2.5 w-2.5" /> You
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {data.currentUserRank.referralCount}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">
                        {data.currentUserRank.totalPoints}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-400">
            {data.totalReferrers} referrers total · Rankings based on approved referrals
          </p>
        </>
      )}
    </div>
  );
}
