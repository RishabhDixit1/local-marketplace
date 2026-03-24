"use client";

import type { MarketplaceFeedStats } from "@/lib/marketplaceFeed";

type FeedHeroProps = {
  stats: MarketplaceFeedStats;
  realtime: {
    label: string;
    className: string;
    dotClassName: string;
  };
};

const statCards: Array<{ key: keyof MarketplaceFeedStats; label: string }> = [
  { key: "total", label: "Live now" },
  { key: "urgent", label: "Urgent" },
  { key: "demand", label: "Needs" },
  { key: "service", label: "Services" },
  { key: "product", label: "Products" },
];

export default function FeedHero({ stats, realtime }: FeedHeroProps) {
  return (
    <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-700)]">Marketplace feed</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
            Posts, offers, and local demand in one working view
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
            The feed is the operating surface. Search from the header, open the profiles that matter, and move directly
            into connection, chat, or task acceptance from each card.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${realtime.className}`}
          title="Realtime feed status"
        >
          <span className={`h-2 w-2 rounded-full ${realtime.dotClassName}`} />
          {realtime.label}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <div key={stat.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{stats[stat.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
