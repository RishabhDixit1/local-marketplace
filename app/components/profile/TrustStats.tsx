"use client";

import type { ReactNode } from "react";
import { BadgeCheck, Clock3, Gauge, Star, TrendingUp, Users } from "lucide-react";
import type { ProfileRecord } from "@/lib/profile/types";

const scoreCard = (label: string, value: string, hint: string, icon: ReactNode) => ({
  label,
  value,
  hint,
  icon,
});

export default function TrustStats({
  profile,
  averageRating,
  reviewCount,
  completionPercent,
  trustScore,
}: {
  profile: ProfileRecord;
  averageRating: number;
  reviewCount: number;
  completionPercent: number;
  trustScore: number;
}) {
  const cards = [
    scoreCard("Trust score", `${Math.round(trustScore || profile.trust_score || 0)}`, "Combined reputation signal", <Gauge className="h-4 w-4" />),
    scoreCard("Completion", `${completionPercent}%`, "Profile depth and readiness", <TrendingUp className="h-4 w-4" />),
    scoreCard("Rating", averageRating ? averageRating.toFixed(1) : "New", `${reviewCount} review${reviewCount === 1 ? "" : "s"}`, <Star className="h-4 w-4" />),
    scoreCard("Verification", profile.verification_level || "email", "Proof and trust level", <BadgeCheck className="h-4 w-4" />),
    scoreCard("Response", `${Math.max(0, Math.round(profile.response_time_minutes || 0)) || "?"} mins`, "Typical reply time", <Clock3 className="h-4 w-4" />),
    scoreCard("Repeat clients", String(profile.repeat_clients_count || 0), "Returning client count", <Users className="h-4 w-4" />),
  ];

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Trust</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Trust Stats</h2>
        </div>
        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          {profile.availability}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.icon}
              {card.label}
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-1 text-sm text-slate-600">{card.hint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
