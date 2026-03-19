"use client";

import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type { MarketplaceReadinessSummary } from "@/lib/profile/readiness";

type ReadinessStat = {
  label: string;
  value: string;
};

const stageStyles: Record<MarketplaceReadinessSummary["stage"], string> = {
  foundation: "border-amber-200 bg-amber-50 text-amber-800",
  momentum: "border-sky-200 bg-sky-50 text-sky-800",
  "market-ready": "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export default function MarketplaceReadinessPanel({
  summary,
  stats,
  loading = false,
}: {
  summary: MarketplaceReadinessSummary;
  stats: ReadinessStat[];
  loading?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.12),transparent_36%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.11),transparent_34%)] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${stageStyles[summary.stage]}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {summary.stageLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                {summary.onboardingComplete ? "Marketplace unlocked" : "Needs onboarding"}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{summary.headline}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{summary.description}</p>
            </div>
          </div>

          {loading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating live metrics
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[22px] border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-6 md:grid-cols-3">
        {summary.actions.map((action) => (
          <article key={action.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">{action.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
            <Link
              href={action.href}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {action.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
